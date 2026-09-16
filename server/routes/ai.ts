import { Router, Response } from 'express';
import { authenticateToken, authorizeRoles, AuthenticatedRequest } from '../middleware/auth';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { AnalyzeRppRequestSchema, AnalyzeGeneralRequestSchema } from '../validators/aiSchemas';
import { extractDocumentContent } from '../services/documentExtractor';
import { analyzeRppDocumentWithGemini, analyzeGeneralObservationWithGemini } from '../services/aiService';
import { createShortLivedSignedUrl } from '../services/storageService';

const router = Router();

// Endpoint 1: Analyze RPPM Document
router.post(
  '/ai-analyze-rpp-document',
  authenticateToken,
  authorizeRoles('ADMIN', 'SUPERVISOR'),
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

      // Perform AI Analysis
      const aiResult = await analyzeRppDocumentWithGemini(reqData, docExtraction);

      return res.status(200).json({
        success: true,
        analysis: aiResult.analysis,
        summary: aiResult.summary,
        documentMeta: {
          wordCount: docExtraction.wordCount,
          totalPages: docExtraction.totalPages,
          isUnreadable: docExtraction.isUnreadable,
          unreadableReason: docExtraction.unreadableReason || null,
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
  authorizeRoles('ADMIN', 'SUPERVISOR'),
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

// Endpoint 3: Short-lived Signed URL for Private Document Viewing
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

      // Verify path starts with user's school_id for isolation
      const pathParts = filePath.split('/');
      const pathSchoolId = pathParts[0];

      if (req.user?.role !== 'ADMIN' && pathSchoolId !== req.user?.school_id) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN_SCHOOL_ACCESS',
          message: 'Anda tidak memiliki akses ke dokumen dari sekolah lain.',
        });
      }

      // If GURU, ensure they can only access files in their own folder
      if (req.user?.role === 'GURU') {
        const pathUserId = pathParts[1];
        if (pathUserId !== req.user.id) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_USER_ACCESS',
            message: 'Anda hanya dapat mengakses dokumen milik sendiri.',
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

export default router;
