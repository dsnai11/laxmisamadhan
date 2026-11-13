import path from 'path';

export interface DetectedFileType {
  mime: string;
  extension: string;
}

const ZIP_MIME_BY_EXTENSION: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

const OLE_MIME_BY_EXTENSION: Record<string, string> = {
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
};

const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.log', '.md']);

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function asciiAt(buffer: Buffer, offset: number, value: string): boolean {
  if (buffer.length < offset + value.length) return false;
  return buffer.subarray(offset, offset + value.length).toString('latin1') === value;
}

export function detectFileType(buffer: Buffer, originalName: string): DetectedFileType | null {
  const ext = path.extname(originalName || '').toLowerCase();

  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', extension: '.png' };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', extension: '.jpg' };
  }
  if (asciiAt(buffer, 0, 'GIF87a') || asciiAt(buffer, 0, 'GIF89a')) {
    return { mime: 'image/gif', extension: '.gif' };
  }
  if (asciiAt(buffer, 0, 'RIFF') && asciiAt(buffer, 8, 'WEBP')) {
    return { mime: 'image/webp', extension: '.webp' };
  }
  if (asciiAt(buffer, 0, 'RIFF') && asciiAt(buffer, 8, 'WAVE')) {
    return { mime: 'audio/wav', extension: '.wav' };
  }
  if (asciiAt(buffer, 0, '%PDF-')) {
    return { mime: 'application/pdf', extension: '.pdf' };
  }
  if (asciiAt(buffer, 0, 'OggS')) {
    return { mime: 'audio/ogg', extension: '.ogg' };
  }
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { mime: 'audio/webm', extension: '.webm' };
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])) {
    return { mime: ZIP_MIME_BY_EXTENSION[ext] || 'application/zip', extension: ext || '.zip' };
  }
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return { mime: OLE_MIME_BY_EXTENSION[ext] || 'application/octet-stream', extension: ext };
  }
  if (asciiAt(buffer, 4, 'ftyp')) {
    return {
      mime: ext === '.m4a' ? 'audio/x-m4a' : 'audio/mp4',
      extension: ext || '.m4a',
    };
  }
  if (startsWith(buffer, [0xff, 0xf1]) || startsWith(buffer, [0xff, 0xf9])) {
    return { mime: 'audio/aac', extension: '.aac' };
  }
  if (asciiAt(buffer, 0, 'ID3') || startsWith(buffer, [0xff, 0xfb])) {
    return { mime: 'audio/mpeg', extension: '.mp3' };
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    const hasBinaryContent = buffer.includes(0x00);
    if (!hasBinaryContent) {
      return {
        mime: ext === '.csv' ? 'text/csv' : 'text/plain',
        extension: ext,
      };
    }
  }

  return null;
}

export function validateUploadedFile(
  file: Express.Multer.File,
  allowedMimeTypes: string[]
): DetectedFileType {
  const detected = detectFileType(file.buffer, file.originalname);
  if (!detected) {
    throw new Error('File content does not match a supported file type');
  }

  const isAllowed =
    allowedMimeTypes.includes(detected.mime) ||
    (detected.mime.startsWith('audio/') && allowedMimeTypes.some((mime) => mime.startsWith('audio/'))) ||
    (detected.mime === 'text/plain' && allowedMimeTypes.includes('text/plain'));

  if (!isAllowed) {
    throw new Error(`File type ${detected.mime} is not allowed`);
  }

  return detected;
}
