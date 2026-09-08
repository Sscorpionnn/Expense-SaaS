import { assertValidCsvUpload, type UploadedCsvFile } from "./csv-file-guard";

function makeFile(overrides: Partial<UploadedCsvFile> = {}): UploadedCsvFile {
  const content = "date,amount\n2025-01-01,10.00\n";
  const buffer = Buffer.from(content);
  return {
    originalname: "transactions.csv",
    mimetype: "text/csv",
    size: buffer.byteLength,
    buffer,
    ...overrides,
  };
}

describe("assertValidCsvUpload", () => {
  it("accepts a well-formed CSV upload", () => {
    expect(() => assertValidCsvUpload(makeFile())).not.toThrow();
  });

  it("rejects a missing file", () => {
    expect(() => assertValidCsvUpload(undefined)).toThrow();
  });

  it("rejects an empty file", () => {
    expect(() => assertValidCsvUpload(makeFile({ size: 0, buffer: Buffer.alloc(0) }))).toThrow();
  });

  it("rejects a file over the size limit", () => {
    expect(() => assertValidCsvUpload(makeFile({ size: 100 * 1024 * 1024 }))).toThrow();
  });

  it("rejects a non-.csv filename", () => {
    expect(() => assertValidCsvUpload(makeFile({ originalname: "transactions.xlsx" }))).toThrow();
  });

  it("rejects an unsupported MIME type", () => {
    expect(() => assertValidCsvUpload(makeFile({ mimetype: "application/zip" }))).toThrow();
  });

  it("rejects a file whose content is actually a ZIP (renamed .csv)", () => {
    const buffer = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("junk")]);
    expect(() =>
      assertValidCsvUpload(makeFile({ buffer, size: buffer.byteLength })),
    ).toThrow();
  });

  it("rejects a file whose content is actually a PNG (renamed .csv)", () => {
    const buffer = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from("junk")]);
    expect(() =>
      assertValidCsvUpload(makeFile({ buffer, size: buffer.byteLength })),
    ).toThrow();
  });

  it("rejects content containing NUL bytes", () => {
    const buffer = Buffer.from("date,amount\n\x00\x00,10\n");
    expect(() => assertValidCsvUpload(makeFile({ buffer, size: buffer.byteLength }))).toThrow();
  });
});
