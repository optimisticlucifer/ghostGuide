// Stub implementation for pdf-parse
export default function pdfParse(buffer: Buffer): Promise<{ text: string }> {
  return Promise.resolve({
    text: "PDF parsing not implemented - please add pdf-parse dependency"
  });
}
