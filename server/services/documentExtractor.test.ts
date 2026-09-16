import { describe, it, expect } from "vitest";
import { validateFileMagicBytes, extractDocumentContent } from "./documentExtractor";

describe("Document Extractor & Magic Byte Validation", () => {
  it("recognizes valid PDF magic bytes (%PDF-)", () => {
    const pdfBuffer = Buffer.from("%PDF-1.7 header content here");
    const result = validateFileMagicBytes(pdfBuffer, "pdf");
    expect(result.isValid).toBe(true);
  });

  it("recognizes valid DOCX magic bytes (PK Zip)", () => {
    const docxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const result = validateFileMagicBytes(docxBuffer, "docx");
    expect(result.isValid).toBe(true);
  });

  it("rejects legacy binary .doc files (D0 CF 11 E0)", () => {
    const legacyDocBuffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const result = validateFileMagicBytes(legacyDocBuffer, "doc");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("legacy");
  });

  it("rejects mismatched file extensions", () => {
    // PDF header but declared as docx
    const pdfBuffer = Buffer.from("%PDF-1.7 header content");
    const result = validateFileMagicBytes(pdfBuffer, "docx");
    expect(result.isValid).toBe(false);
  });

  it("extracts text from plain text buffer cleanly", async () => {
    const txtBuffer = Buffer.from(
      "Teks Modul Ajar Fisika Pembelajaran Mendalam kata1 kata2 kata3 kata4 kata5 kata6 kata7 kata8 kata9 kata10 kata11 kata12 kata13 kata14 kata15 kata16 kata17"
    );
    const result = await extractDocumentContent(txtBuffer, "txt");
    expect(result.isUnreadable).toBe(false);
    expect(result.wordCount).toBeGreaterThanOrEqual(20);
    expect(result.fullText).toContain("Pembelajaran Mendalam");
  });
});
