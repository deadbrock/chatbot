const logger = require('./logger');

function extractMessageId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value._serialized || value.id || null;
  }
  return String(value);
}

function resolveWhatsAppTimestamp(msg) {
  if (!msg || typeof msg !== 'object') return null;

  const candidates = [
    msg.t,
    msg.timestamp,
    msg.messageTimestamp,
    msg.msgTimestamp,
    msg.lastUpdateFromServerTs,
    msg._data?.t,
    msg._data?.timestamp,
    msg._data?.messageTimestamp,
    typeof msg.id === 'object' ? msg.id?.timestamp : null
  ];

  for (const raw of candidates) {
    if (raw == null) continue;

    if (raw instanceof Date) {
      if (!Number.isNaN(raw.getTime())) return raw;
      continue;
    }

    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) continue;

    // Milissegundos (13+ dígitos)
    if (num > 1e12) return new Date(num);
    // Segundos do WhatsApp (~10 dígitos)
    if (num > 1e9) return new Date(num * 1000);
    // Segundos antigos (raro)
    if (num > 1e8) return new Date(num * 1000);
  }

  return null;
}

function resolveWhatsAppTimestampOrNow(msg, { allowNow = false } = {}) {
  const resolved = resolveWhatsAppTimestamp(msg);
  if (resolved) return resolved;
  if (allowNow) return new Date();

  const messageId = extractMessageId(msg?.id);
  logger.warn(`⚠️ Timestamp original não encontrado${messageId ? ` (${messageId})` : ''}`);
  return null;
}

module.exports = {
  extractMessageId,
  resolveWhatsAppTimestamp,
  resolveWhatsAppTimestampOrNow
};
