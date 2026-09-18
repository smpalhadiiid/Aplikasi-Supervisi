import { describe, it, expect } from "vitest";
import {
  validateDocumentFile,
  buildDocumentStoragePath,
  MAX_FILE_SIZE,
} from "./storageService";

describe("Storage Service & Document Validation", () => {
  it("validates legitimate PDF files based on magic bytes %PDF", () => {
    const pdfHeader = Buffer.from("%PDF-1.4 sample content for lesson plan");
    const result = validateDocumentFile(pdfHeader, "modul_ajar.pdf", "application/pdf");
    expect(result.isValid).toBe(true);
    expect(result.detectedType).toBe("pdf");
  });

  it("validates legitimate DOCX files based on ZIP magic bytes PK\\x03\\x04", () => {
    const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const result = validateDocumentFile(docxHeader, "rpp_kurikulum.docx");
    expect(result.isValid).toBe(true);
    expect(result.detectedType).toBe("docx");
  });

  it("rejects legacy binary .doc files with OLE magic bytes", () => {
    const docHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const result = validateDocumentFile(docHeader, "old_file.doc");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain(".doc binary OLE");
  });

  it("rejects executable or script files masquerading with .pdf extension", () => {
    const fakePdf = Buffer.from("<?php echo 'malicious code'; ?>");
    const result = validateDocumentFile(fakePdf, "exploit.pdf");
    expect(result.isValid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects oversized files exceeding 20MB limit", () => {
    const oversizedBuffer = { length: MAX_FILE_SIZE + 1024 } as Buffer;
    const result = validateDocumentFile(oversizedBuffer, "large.pdf");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("melebihi batas maksimal");
  });

  it("generates structured isolated multi-tenant path: schools/{school_id}/teachers/{teacher_id}/{uuid}_{filename}", () => {
    const path = buildDocumentStoragePath("sch-001", "teach-002", "Modul Ajar Deep Learning.pdf");
    expect(path).toMatch(/^schools\/sch-001\/teachers\/teach-002\/[0-9a-f-]+_Modul_Ajar_Deep_Learning\.pdf$/);
  });
});
