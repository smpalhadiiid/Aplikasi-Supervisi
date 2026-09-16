import { z } from 'zod';

export const InstrumentItemSchema = z.object({
  id: z.string().min(1, 'ID instrumen wajib diisi'),
  code: z.string().optional().default(''),
  indicator: z.string().optional().default('Indikator'),
  description: z.string().optional().default(''),
  min_score: z.coerce.number().optional().default(1),
  max_score: z.coerce.number().optional().default(3),
}).passthrough();

export const AnalyzeRppRequestSchema = z.object({
  documentText: z.string().optional(),
  documentBase64: z.string().optional(),
  fileType: z.enum(['pdf', 'docx', 'txt']).optional().default('pdf'),
  fileName: z.string().optional().default('Dokumen_RPPM.pdf'),
  teacherId: z.string().optional(),
  teacherName: z.string().optional().default('Guru'),
  subject: z.string().optional().default('-'),
  topic: z.string().optional().default('-'),
  instrumentItems: z.array(InstrumentItemSchema).min(1, 'Daftar indikator instrumen tidak boleh kosong'),
}).passthrough();

export const EvidenceStatusSchema = z.enum(['FOUND', 'PARTIAL', 'NOT_FOUND', 'UNREADABLE']);

export const AIIndicatorAnalysisSchema = z.object({
  item_id: z.string(),
  score_recommendation: z.number().int().min(1).max(3),
  evidence_status: EvidenceStatusSchema,
  evidence: z.array(z.string()),
  location: z.string().optional().default('-'),
  reason: z.string(),
  missing_elements: z.array(z.string()).optional().default([]),
  strength: z.string().optional().default('-'),
  revision_note: z.string().optional().default('-'),
  recommendation: z.string(),
  confidence: z.number().min(0).max(1),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'MODIFIED']).optional().default('PENDING'),
});

export const AISummarySchema = z.object({
  strengths: z.array(z.string()),
  priority_improvements: z.array(z.string()),
  general_recommendation: z.string(),
});

export const AIAnalysisResultSchema = z.object({
  analysis: z.array(AIIndicatorAnalysisSchema),
  summary: AISummarySchema,
});

export const AnalyzeGeneralRequestSchema = z.object({
  type: z.enum(['rpp', 'supervision']),
  teacherName: z.string().optional().default('Guru'),
  subject: z.string().optional().default('-'),
  topic: z.string().optional().default('-'),
  classGrade: z.string().optional().default('-'),
  totalScore: z.coerce.number().optional().default(0),
  maxScore: z.coerce.number().optional().default(100),
  notes: z.string().optional().default(''),
  items: z.array(
    z.object({
      indicator: z.string().optional().default('Indikator'),
      code: z.string().optional().default(''),
      score: z.coerce.number().optional().default(0),
      notes: z.string().optional().default(''),
    }).passthrough()
  ).optional().default([]),
}).passthrough();

export type AnalyzeRppRequest = z.infer<typeof AnalyzeRppRequestSchema>;
export type AnalyzeGeneralRequest = z.infer<typeof AnalyzeGeneralRequestSchema>;
export type AIIndicatorAnalysis = z.infer<typeof AIIndicatorAnalysisSchema>;
export type AIAnalysisResult = z.infer<typeof AIAnalysisResultSchema>;
