const GENERIC_NAMES = new Set([
  'usuário',
  'usuario',
  'sem nome',
  'cliente',
  'user',
  'unknown',
  'contato'
]);

function normalizePhoneDigits(phone) {
  if (!phone) return '';
  return String(phone).split('@')[0].replace(/\D/g, '');
}

function isWhatsAppLidJid(value) {
  if (!value) return false;
  return String(value).includes('@lid');
}

function isValidPhoneDigits(digits) {
  if (!digits) return false;
  // LIDs do WhatsApp têm 14+ dígitos e não são telefones reais
  if (digits.length > 13) return false;
  if (digits.length < 8) return false;
  return true;
}

function formatPhoneDisplay(phone) {
  const digits = normalizePhoneDigits(phone);
  if (!isValidPhoneDigits(digits)) return '';

  let national = digits;
  if (digits.startsWith('55') && digits.length > 10) {
    national = digits.slice(2);
  }

  // Celular BR: DDD (2) + 9 dígitos
  if (national.length === 11) {
    const ddd = national.slice(0, 2);
    const number = national.slice(2);
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }

  // Fixo BR: DDD (2) + 8 dígitos
  if (national.length === 10) {
    const ddd = national.slice(0, 2);
    const number = national.slice(2);
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  // Internacional válido
  if (digits.length >= 10 && digits.length <= 13) {
    return `+${digits}`;
  }

  return '';
}

function isGenericContactName(name) {
  if (!name || typeof name !== 'string') return true;
  const normalized = name.trim().toLowerCase();
  if (!normalized || GENERIC_NAMES.has(normalized)) return true;

  // Nome salvo como número/LID inválido
  const nameDigits = normalizePhoneDigits(name);
  if (nameDigits && name === nameDigits) return true;
  if (nameDigits && !isValidPhoneDigits(nameDigits)) return true;
  if (name.startsWith('+') && normalizePhoneDigits(name) && !isValidPhoneDigits(normalizePhoneDigits(name))) {
    return true;
  }

  return false;
}

function resolveContactDisplayName({
  name,
  userName,
  phone,
  userPhone
} = {}) {
  const phoneRaw = phone || userPhone || '';
  const digits = normalizePhoneDigits(phoneRaw);
  const formattedPhone = isValidPhoneDigits(digits) ? formatPhoneDisplay(phoneRaw) : '';
  const fallback = formattedPhone || (isValidPhoneDigits(digits) ? digits : '');

  const candidates = [name, userName];
  for (const candidate of candidates) {
    if (!isGenericContactName(candidate)) {
      return candidate.trim();
    }
  }

  return fallback || 'Contato';
}

function resolveContactNameForStorage(name, phone) {
  if (!isGenericContactName(name)) return name.trim();
  const formatted = formatPhoneDisplay(phone);
  if (formatted) return formatted;
  const digits = normalizePhoneDigits(phone);
  if (isValidPhoneDigits(digits)) return digits;
  return '';
}

module.exports = {
  GENERIC_NAMES,
  normalizePhoneDigits,
  isWhatsAppLidJid,
  isValidPhoneDigits,
  formatPhoneDisplay,
  isGenericContactName,
  resolveContactDisplayName,
  resolveContactNameForStorage
};
