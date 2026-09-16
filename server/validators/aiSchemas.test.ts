import { describe, it, expect } from "vitest";
import {
  AnalyzeRppRequestSchema,
  AIAnalysisResultSchema,
} from "./aiSchemas";

describe("AI Schema Zod Validation", () => {
  it("validates a valid document analysis request payload", () => {
    const validPayload = {
      fileName: "Modul_Ajar_Fisika.pdf",
      fileType: "pdf",
      documentText: "Pembelajaran mendalam tentang gelombang elektromagnetik...",
      teacherName: "Budi Santoso",
      subject: "Fisika",
      topic: "Gelombang Elektromagnetik",
      instrumentItems: [
        {
          id: "item-1",
          code: "IND-01",
          indicator: "Tujuan pembelajaran memuat HOTS",
          description: "Menganalisis fenomena gelombang",
        },
      ],
    };

    const result = AnalyzeRppRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects request payload when instrumentItems is empty", () => {
    const invalidPayload = {
      fileName: "Modul_Ajar_Fisika.pdf",
      fileType: "pdf",
      documentText: "Beberapa teks...",
      teacherName: "Budi",
      subject: "Fisika",
      topic: "Gelombang",
      instrumentItems: [],
    };

    const result = AnalyzeRppRequestSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });

  it("validates valid AI document analysis output schema", () => {
    const validOutput = {
      analysis: [
        {
          item_id: "item-1",
          score_recommendation: 3,
          evidence_status: "FOUND",
          evidence: ["Peserta didik menganalisis fenomena gelombang secara mandiri."],
          location: "Halaman 2",
          reason: "Tujuan pembelajaran secara eksplisit memuat indikator menganalisis.",
          missing_elements: [],
          strength: "Indikator HOTS tersusun sistematis.",
          revision_note: "Sangat baik.",
          recommendation: "Pertahankan struktur modul.",
          confidence: 0.95,
        },
      ],
      summary: {
        strengths: ["Modul ajar memuat pembelajaran mendalam"],
        priority_improvements: ["Lengkapi rubrik asesmen formatif"],
        general_recommendation: "Modul siap digunakan dengan sedikit perbaikan rubrik.",
      },
    };

    const result = AIAnalysisResultSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("rejects AI output when score_recommendation is outside 1-3 range", () => {
    const invalidOutput = {
      analysis: [
        {
          item_id: "item-1",
          score_recommendation: 5, // Invalid, max is 3
          evidence_status: "FOUND",
          evidence: ["Beberapa bukti"],
          reason: "Alasan",
          strength: "-",
          revision_note: "-",
          recommendation: "-",
          confidence: 0.9,
        },
      ],
      summary: {
        strengths: [],
        priority_improvements: [],
        general_recommendation: "Beberapa rekomendasi",
      },
    };

    const result = AIAnalysisResultSchema.safeParse(invalidOutput);
    expect(result.success).toBe(false);
  });
});
