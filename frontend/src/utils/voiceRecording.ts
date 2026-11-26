// Builds the File for a finished voice recording. The recorder attaches it to the ticket form
// automatically when recording stops (a recording used to be lost if the person submitted the
// ticket without clicking "Attach Voice Message"). Unit-tested in voiceRecording.test.ts.
export function voiceFileName(ext: string, now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `voice-message-${stamp}.${ext}`;
}

// Returns null for an empty recording so nothing useless is attached.
export function buildVoiceFile(chunks: Blob[], format: { mimeType: string; ext: string }, now: Date = new Date()): File | null {
  const blob = new Blob(chunks, { type: format.mimeType });
  if (blob.size === 0) return null;
  return new File([blob], voiceFileName(format.ext, now), { type: format.mimeType, lastModified: now.getTime() });
}
