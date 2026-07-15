const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
  isBase64Payload,
  guessMimeFromBase64,
  extensionFromMimetype,
  normalizeMessageType
} = require('../utils/chatMediaUtils');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/chat');

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

async function saveBuffer(buffer, { filename, mimetype }) {
  await ensureUploadDir();
  const ext = path.extname(filename) || extensionFromMimetype(mimetype);
  const storedName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  const filepath = path.join(UPLOAD_DIR, storedName);
  await fs.writeFile(filepath, buffer);

  return {
    filepath,
    storedFilename: storedName,
    publicUrl: `/uploads/chat/${storedName}`,
    filename: filename || storedName,
    mimetype,
    size: buffer.length
  };
}

function extractBase64Data(text) {
  const trimmed = (text || '').trim();
  if (trimmed.startsWith('data:')) {
    const comma = trimmed.indexOf(',');
    return comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
  }
  return trimmed;
}

async function saveBase64Body(body, type = 'document') {
  try {
    const mimetype = guessMimeFromBase64(body);
    const ext = extensionFromMimetype(mimetype);
    const buffer = Buffer.from(extractBase64Data(body), 'base64');
    if (!buffer.length) return null;

    return saveBuffer(buffer, {
      filename: `whatsapp_${normalizeMessageType(type)}_${Date.now()}${ext}`,
      mimetype
    });
  } catch (error) {
    logger.warn('Falha ao salvar base64 como arquivo:', error.message);
    return null;
  }
}

async function downloadWhatsAppMedia(whatsappClient, rawMessage) {
  const raw = rawMessage?._data || rawMessage;
  if (!raw) return null;

  const hasMedia = Boolean(
    raw.hasMedia
    || raw.isMedia
    || raw.isMMS
    || ['image', 'video', 'audio', 'ptt', 'document', 'sticker'].includes(raw.type)
  );

  if (!hasMedia) return null;

  if (whatsappClient?.client?.decryptFile) {
    try {
      const buffer = await whatsappClient.client.decryptFile(raw);
      if (buffer?.length) {
        const mimetype = raw.mimetype || raw.mimeType || guessMimeFromBase64('');
        const filename = raw.filename || raw.fileName
          || `whatsapp_${raw.type || 'media'}_${Date.now()}${extensionFromMimetype(mimetype)}`;
        return { buffer, mimetype, filename };
      }
    } catch (error) {
      logger.warn('decryptFile falhou, tentando fallback base64:', error.message);
    }
  }

  const body = raw.body || rawMessage?.body || '';
  if (isBase64Payload(body)) {
    const mimetype = raw.mimetype || raw.mimeType || guessMimeFromBase64(body);
    const buffer = Buffer.from(extractBase64Data(body), 'base64');
    if (buffer.length) {
      return {
        buffer,
        mimetype,
        filename: raw.filename || `whatsapp_${raw.type || 'media'}_${Date.now()}${extensionFromMimetype(mimetype)}`
      };
    }
  }

  return null;
}

async function processIncomingMedia(whatsappClient, rawMessage) {
  const downloaded = await downloadWhatsAppMedia(whatsappClient, rawMessage);
  if (!downloaded) return null;
  return saveBuffer(downloaded.buffer, {
    filename: downloaded.filename,
    mimetype: downloaded.mimetype
  });
}

function resolveLocalPathFromPublicUrl(publicUrl) {
  if (!publicUrl) return null;
  const filename = path.basename(publicUrl);
  return path.join(UPLOAD_DIR, filename);
}

module.exports = {
  UPLOAD_DIR,
  ensureUploadDir,
  saveBuffer,
  saveBase64Body,
  downloadWhatsAppMedia,
  processIncomingMedia,
  resolveLocalPathFromPublicUrl
};
