export function generateId(): string {
  return crypto.randomUUID()
}
export function fileNameToTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
}
