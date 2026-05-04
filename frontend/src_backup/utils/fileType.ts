/**
 * Get file extension from MIME type or file type string.
 * Default to .pdf when unknown.
 */
export function getExtensionFromFileType(fileType?: string | null): string {
  if (!fileType || typeof fileType !== 'string') return '.pdf'
  const t = fileType.toLowerCase().trim()
  if (t.includes('pdf')) return '.pdf'
  if (t.includes('word') || t.includes('document') || t === 'application/msword') return '.docx'
  if (t.includes('excel') || t.includes('spreadsheet')) return '.xlsx'
  if (t.includes('image/png')) return '.png'
  if (t.includes('image/jpeg') || t.includes('image/jpg')) return '.jpg'
  if (t.includes('image/gif')) return '.gif'
  if (t.includes('image/webp')) return '.webp'
  if (t.includes('image/')) return '.png'
  if (t.startsWith('.') && t.length <= 5) return t
  return '.pdf'
}

/** Ensure filename has correct extension; default .pdf */
export function ensureDownloadFilename(name: string, fileType?: string | null): string {
  const ext = getExtensionFromFileType(fileType)
  if (!name) return `document${ext}`
  if (/\.(pdf|docx?|xlsx?|png|jpe?g|gif|webp)$/i.test(name)) return name
  return name.replace(/\.[^.]+$/, '') + ext
}
