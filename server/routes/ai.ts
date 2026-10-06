import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { authenticateToken, authorizeRoles, AuthenticatedRequest, setSupabaseServerClient } from '../middleware/auth';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { AnalyzeRppRequestSchema, AnalyzeGeneralRequestSchema } from '../validators/aiSchemas';
import { extractDocumentContent } from '../services/documentExtractor';
import { analyzeRppDocumentWithGemini, analyzeGeneralObservationWithGemini } from '../services/aiService';
import {
  createShortLivedSignedUrl,
  uploadPrivateDocument,
  validateDocumentFile,
} from '../services/storageService';

const router = Router();

// Endpoint 1: Analyze RPPM Document
router.post(
  '/ai-analyze-rpp-document',
  authenticateToken,
  authorizeRoles('ADMIN', 'SUPERVISOR', 'GURU'),
  aiRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate input using Zod
      const parseResult = AnalyzeRppRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Permintaan tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', '),
        });
      }

      const reqData = parseResult.data;
      let docBuffer: Buffer;
      let fileType = reqData.fileType || 'pdf';

      if (reqData.documentBase64) {
        const base64Data = reqData.documentBase64.includes(',')
          ? reqData.documentBase64.split(',')[1]
          : reqData.documentBase64;
        docBuffer = Buffer.from(base64Data, 'base64');
      } else if (reqData.documentText) {
        docBuffer = Buffer.from(reqData.documentText, 'utf-8');
        fileType = 'txt';
      } else {
        return res.status(400).json({
          success: false,
          error: 'MISSING_DOCUMENT',
          message: 'Dokumen RPPM (teks atau file base64) wajib dilampirkan.',
        });
      }

      // Extract document content securely
      const docExtraction = await extractDocumentContent(docBuffer, fileType);

      // Jika file benar-benar rusak/kosong dan tidak ada visual base64 PDF
      const canGeminiProcessMultimodal = Boolean(reqData.documentBase64 && fileType === 'pdf');
      if (docExtraction.isUnreadable && !canGeminiProcessMultimodal) {
        return res.status(200).json({
          success: false,
          error: 'UNREADABLE_DOCUMENT',
          isUnreadable: true,
          message:
            docExtraction.unreadableReason ||
            'Dokumen tidak memenuhi kriteria kelayakan pemrosesan teks (teks terlalu singkat atau dokumen rusak).',
          documentMeta: {
            wordCount: docExtraction.wordCount,
            totalPages: docExtraction.totalPages,
            isUnreadable: true,
            unreadableReason: docExtraction.unreadableReason,
          },
        });
      }

      // Perform AI Analysis
      const aiResult = await analyzeRppDocumentWithGemini(reqData, docExtraction);

      return res.status(200).json({
        success: true,
        analysis: aiResult.analysis,
        summary: aiResult.summary,
        documentMeta: {
          wordCount: docExtraction.wordCount,
          totalPages: docExtraction.totalPages,
          isUnreadable: false,
          unreadableReason: null,
          extractedTextPreview: docExtraction.fullText ? docExtraction.fullText.slice(0, 1000) : '',
        },
      });
    } catch (err: any) {
      console.error('[API AI RPP Error]:', err?.message || err);
      return res.status(500).json({
        success: false,
        error: 'AI_PROCESSING_ERROR',
        message: err?.message || 'Terjadi kesalahan saat memproses analisis AI.',
      });
    }
  }
);

// Endpoint 2: Analyze General Observation
router.post(
  '/ai-analyze',
  authenticateToken,
  authorizeRoles('ADMIN', 'SUPERVISOR', 'GURU'),
  aiRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parseResult = AnalyzeGeneralRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Permintaan tidak valid: ' + parseResult.error.issues.map((i) => i.message).join(', '),
        });
      }

      const aiResult = await analyzeGeneralObservationWithGemini(parseResult.data);

      return res.status(200).json({
        success: true,
        analysis: aiResult,
      });
    } catch (err: any) {
      console.error('[API AI Observation Error]:', err?.message || err);
      return res.status(500).json({
        success: false,
        error: 'AI_PROCESSING_ERROR',
        message: err?.message || 'Terjadi kesalahan saat memproses analisis observasi AI.',
      });
    }
  }
);

// Endpoint 3: Upload Dokumen Privat dengan Validasi Magic Bytes & Isolasi Tenant
router.post(
  '/document-upload',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fileName, fileBase64, teacherId, mimeType } = req.body;

      if (!fileName || !fileBase64) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'Nama file dan konten base64 wajib disertakan.',
        });
      }

      if (!req.user || !req.user.school_id) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Sesi pengguna tidak valid.',
        });
      }

      // Validasi hak kepemilikan guru (Guru hanya boleh upload untuk dirinya sendiri)
      let resolvedTeacherId = req.user.role === 'GURU'
        ? (req.user.teacher_id || req.user.id)
        : (teacherId || req.user.teacher_id || req.user.id);

      if (req.user.role === 'GURU') {
        if (req.user.teacher_id && resolvedTeacherId !== req.user.teacher_id && resolvedTeacherId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN',
            message: 'Guru hanya diizinkan mengunggah dokumen untuk profil sendiri.',
          });
        }
      }

      const rawBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
      const buffer = Buffer.from(rawBase64, 'base64');

      const validation = validateDocumentFile(buffer, fileName, mimeType);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_FILE',
          message: validation.error || 'File tidak memenuhi syarat keamanan.',
        });
      }

      // school_id strictly from authenticated database user profile
      const schoolId = req.user.school_id;
      const uploadResult = await uploadPrivateDocument(
        schoolId,
        resolvedTeacherId,
        fileName,
        buffer,
        mimeType
      );

      if (uploadResult.error || !uploadResult.filePath) {
        return res.status(500).json({
          success: false,
          error: 'UPLOAD_FAILED',
          message: uploadResult.error || 'Gagal menyimpan dokumen ke storage privat.',
        });
      }

      return res.status(200).json({
        success: true,
        filePath: uploadResult.filePath,
        fileName,
        fileSize: buffer.length,
        fileType: validation.detectedType,
      });
    } catch (err: any) {
      console.error('[API Document Upload Error]:', err?.message || err);
      return res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: err?.message || 'Terjadi kesalahan saat mengunggah dokumen.',
      });
    }
  }
);

// Endpoint 4: Short-lived Signed URL for Private Document Viewing
router.post(
  '/document-signed-url',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { filePath } = req.body;
      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_PATH',
          message: 'Path dokumen wajib disertakan.',
        });
      }

      // Verifikasi isolasi multi-tenant sekolah: path harus berada di schools/{school_id}/
      const expectedSchoolPrefix = `schools/${req.user?.school_id}/`;
      const legacySchoolPrefix = `${req.user?.school_id}/`;

      if (
        req.user?.role !== 'ADMIN' &&
        !filePath.startsWith(expectedSchoolPrefix) &&
        !filePath.startsWith(legacySchoolPrefix)
      ) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN_SCHOOL_ACCESS',
          message: 'Akses ditolak: Dokumen berasal dari sekolah lain.',
        });
      }

      // Jika role GURU: verifikasi bahwa path dokumen merujuk ke dirinya sendiri
      if (req.user?.role === 'GURU') {
        const ownTeacherFolder = `/teachers/${req.user.teacher_id}/`;
        const ownUserFolder = `/${req.user.id}/`;
        const matchesTeacher = req.user.teacher_id && filePath.includes(ownTeacherFolder);
        const matchesUser = filePath.includes(ownUserFolder);

        if (!matchesTeacher && !matchesUser) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_USER_ACCESS',
            message: 'Akses ditolak: Guru hanya dapat mengakses dokumen miliknya sendiri.',
          });
        }
      }

      const { signedUrl, error } = await createShortLivedSignedUrl(filePath, 1800);
      if (error || !signedUrl) {
        return res.status(500).json({
          success: false,
          error: 'STORAGE_ERROR',
          message: error || 'Gagal membuat akses URL privat.',
        });
      }

      return res.status(200).json({
        success: true,
        signedUrl,
        expiresIn: 1800,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Terjadi kesalahan saat membuat URL dokumen.',
      });
    }
  }
);

// Endpoint 5: Update Supabase Configuration dynamically
router.post('/supabase-config', async (req, res) => {
  try {
    const { supabaseUrl, supabaseAnonKey } = req.body;
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(400).json({ success: false, message: 'URL dan Anon Key wajib diisi.' });
    }

    const cleanUrl = String(supabaseUrl).trim();
    const cleanKey = String(supabaseAnonKey).trim();

    // Update runtime server client
    const newServerClient = createClient(cleanUrl, cleanKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    setSupabaseServerClient(newServerClient);

    // Save to .env so it persists across server restarts
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      } else {
        const examplePath = path.resolve(process.cwd(), '.env.example');
        if (fs.existsSync(examplePath)) {
          envContent = fs.readFileSync(examplePath, 'utf-8');
        }
      }

      if (envContent.includes('VITE_SUPABASE_URL=')) {
        envContent = envContent.replace(/VITE_SUPABASE_URL=.*/, `VITE_SUPABASE_URL=${cleanUrl}`);
      } else {
        envContent += `\nVITE_SUPABASE_URL=${cleanUrl}`;
      }

      if (envContent.includes('VITE_SUPABASE_ANON_KEY=')) {
        envContent = envContent.replace(/VITE_SUPABASE_ANON_KEY=.*/, `VITE_SUPABASE_ANON_KEY=${cleanKey}`);
      } else {
        envContent += `\nVITE_SUPABASE_ANON_KEY=${cleanKey}`;
      }

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
      console.log('[Server] File .env berhasil diperbarui dengan kredensial Supabase baru.');
    } catch (fsErr) {
      console.warn('[Server] Gagal menulis ke .env:', fsErr);
    }

    return res.json({ success: true, message: 'Konfigurasi Supabase berhasil diperbarui pada server.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Gagal menyimpan konfigurasi.' });
  }
});

export default router;

