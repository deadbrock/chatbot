const MEDIA_LABELS = {
  image: '📷 Foto',
  video: '🎬 Vídeo',
  audio: '🎵 Áudio',
  voice: '🎵 Áudio',
  ptt: '🎵 Áudio',
  document: '📄 Arquivo',
  sticker: '🎨 Figurinha',
  location: '📍 Localização',
  contact: '👤 Contato',
  media: '📎 Mídia',
  text: ''
};

function isBase64Payload(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:')) return true;
  if (trimmed.length < 120) return false;

  const head = trimmed.substring(0, 32);
  if (/^\/9j\//.test(head)) return true;
  if (/^iVBORw0KGgo/.test(head)) return true;
  if (/^R0lGOD/.test(head)) return true;
  if (/^UklGR/.test(head)) return true;
  if (/^JVBERi0/.test(head)) return true;
  if (/^UEsDB/.test(head)) return true;

  const sample = trimmed.substring(0, 512);
  return /^[A-Za-z0-9+/=\s]+$/.test(sample) && trimmed.length > 300;
}

function isBase64Image(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.startsWith('data:image/')) return true;
  return /^\/9j\//.test(trimmed) || /^iVBORw0KGgo/.test(trimmed) || /^R0lGOD/.test(trimmed);
}

function getMediaPreviewLabel(type, hasMedia = false) {
  if (!type || type === 'text' || type === 'chat') {
    return hasMedia ? MEDIA_LABELS.media : '';
  }
  return MEDIA_LABELS[type] || MEDIA_LABELS.media;
}

function sanitizeBodyForDisplay(body, type = 'text', hasMedia = false) {
  const label = getMediaPreviewLabel(type, hasMedia);
  const isMediaType = hasMedia || (type && !['text', 'chat', 'system'].includes(type));

  if (isMediaType) {
    if (body && !isBase64Payload(body)) return body;
    return label || '📎 Mídia';
  }

  if (body && isBase64Payload(body)) {
    return label || '📎 Mídia';
  }

  return body || '';
}

function guessMimeFromBase64(text) {
  const trimmed = (text || '').trim();
  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);/);
    return match ? match[1] : 'application/octet-stream';
  }
  if (/^\/9j\//.test(trimmed)) return 'image/jpeg';
  if (/^iVBORw0KGgo/.test(trimmed)) return 'image/png';
  if (/^R0lGOD/.test(trimmed)) return 'image/gif';
  if (/^JVBERi0/.test(trimmed)) return 'application/pdf';
  return 'application/octet-stream';
}

function extensionFromMimetype(mimetype = '') {
  const map = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
    'application/zip': '.zip'
  };
  return map[mimetype] || '.bin';
}

function normalizeMessageType(type) {
  if (!type || type === 'chat') return 'text';
  if (type === 'ptt') return 'audio';
  return type;
}

module.exports = {
  MEDIA_LABELS,
  isBase64Payload,
  isBase64Image,
  getMediaPreviewLabel,
  sanitizeBodyForDisplay,
  guessMimeFromBase64,
  extensionFromMimetype,
  normalizeMessageType
};
