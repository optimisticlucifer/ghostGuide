// Stub implementation for mammoth
export function extractRawText(options: { buffer: Buffer }): Promise<{ value: string }> {
  return Promise.resolve({
    value: "Word document parsing not implemented - please add mammoth dependency"
  });
}
