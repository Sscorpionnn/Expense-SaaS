import { BadRequestException } from "@nestjs/common";
import { CSV_IMPORT } from "@expense-saas/config";

// Magic bytes for common binary formats a "renamed" malicious upload might
// actually be — checked even though the extension/MIME claims CSV/text.
const BINARY_SIGNATURES: readonly Buffer[] = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]), // ZIP / XLSX / DOCX
  Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
  Buffer.from([0x47, 0x49, 0x46, 0x38]), // GIF8
  Buffer.from([0xff, 0xd8, 0xff]), // JPEG
];

export interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Throws BadRequestException on any violation; returns normally if the file is OK. */
export function assertValidCsvUpload(file: UploadedCsvFile | undefined): asserts file is UploadedCsvFile {
  if (!file) throw new BadRequestException("No file uploaded");
  if (file.size === 0) throw new BadRequestException("File is empty");
  if (file.size > CSV_IMPORT.MAX_FILE_SIZE_BYTES) {
    throw new BadRequestException(
      `File exceeds the ${CSV_IMPORT.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`,
    );
  }
  if (!file.originalname.toLowerCase().endsWith(".csv")) {
    throw new BadRequestException("File must have a .csv extension");
  }
  if (!(CSV_IMPORT.ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new BadRequestException(`Unsupported content type: ${file.mimetype}`);
  }

  const head = file.buffer.subarray(0, 8);
  if (BINARY_SIGNATURES.some((sig) => head.subarray(0, sig.length).equals(sig))) {
    throw new BadRequestException("File does not look like a CSV (binary signature detected)");
  }
  if (file.buffer.includes(0)) {
    throw new BadRequestException("File contains binary data and is not a valid CSV");
  }
}
