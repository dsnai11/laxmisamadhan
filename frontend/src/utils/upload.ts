// Attachment size limit. nginx rejects request bodies over 25 MB (client_max_body_size 25M in
// laxmisamadhan.conf) with a bare 413, so check in the browser first and explain clearly.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const TOO_LARGE_MESSAGE = 'File is too large. The maximum attachment size is 25 MB.';

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Error message if the file can't be uploaded, else null. */
export function uploadSizeError(file: { size: number; name?: string }): string | null {
  if (file.size > MAX_UPLOAD_BYTES) {
    return `"${file.name || 'File'}" is ${formatBytes(file.size)}. The maximum attachment size is 25 MB.`;
  }
  if (file.size === 0) return `"${file.name || 'File'}" is empty.`;
  return null;
}
