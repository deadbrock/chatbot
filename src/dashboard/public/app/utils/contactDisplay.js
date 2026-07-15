const GENERIC_NAMES = new Set([
  'usuário',
  'usuario',
  'sem nome',
  'cliente',
  'user',
  'unknown',
  'contato'
]);

export function normalizePhoneDigits(phone) {
  if (!phone) return '';
  return String(phone).split('@')[0].replace(/\D/g, '');
}

export function isValidPhoneDigits(digits) {
  if (!digits) return false;
  if (digits.length > 13) return false;
  if (digits.length < 8) return false;
  return true;
}

export function formatPhoneDisplay(phone) {
  const digits = normalizePhoneDigits(phone);
  if (!isValidPhoneDigits(digits)) return '';

  let national = digits;
  if (digits.startsWith('55') && digits.length > 10) {
    national = digits.slice(2);
  }

  if (national.length === 11) {
    const ddd = national.slice(0, 2);
    const number = national.slice(2);
    return `(${ddd}) ${number.slice(0, 5)}-${number.slice(5)}`;
  }

  if (national.length === 10) {
    const ddd = national.slice(0, 2);
    const number = national.slice(2);
    return `(${ddd}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  if (digits.length >= 10 && digits.length <= 13) {
    return `+${digits}`;
  }

  return '';
}

function isGenericDisplayName(name) {
  if (!name || typeof name !== 'string') return true;
  const normalized = name.trim().toLowerCase();
  if (!normalized || ['usuário', 'usuario', 'sem nome', 'cliente', 'contato'].includes(normalized)) {
    return true;
  }
  const digits = normalizePhoneDigits(name);
  if (digits && !isValidPhoneDigits(digits)) return true;
  if (name.startsWith('+') && digits && !isValidPhoneDigits(digits)) return true;
  return false;
}

export function isGenericContactName(name) {
  if (!name || typeof name !== 'string') return true;
  const normalized = name.trim().toLowerCase();
  return !normalized || GENERIC_NAMES.has(normalized);
}

export function resolveContactDisplayName(ticketOrContact = {}) {
  const contact = ticketOrContact.contact || ticketOrContact;
  const phone = contact.phone
    || contact.number
    || ticketOrContact.userPhone
    || ticketOrContact.phone
    || '';

  if (ticketOrContact.displayName && !isGenericContactName(ticketOrContact.displayName)) {
    return ticketOrContact.displayName;
  }

  const candidates = [
    contact.displayName,
    contact.name,
    ticketOrContact.userName,
    ticketOrContact.name
  ];

  for (const candidate of candidates) {
    if (!isGenericDisplayName(candidate)) {
      return candidate.trim();
    }
  }

  const digits = normalizePhoneDigits(phone);
  const formatted = isValidPhoneDigits(digits) ? formatPhoneDisplay(phone) : '';
  return formatted || (isValidPhoneDigits(digits) ? digits : '') || 'Contato';
}

export function getContactInitials(displayName, phone = '') {
  if (!isGenericContactName(displayName) && displayName) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const digits = normalizePhoneDigits(phone || displayName);
  return digits ? digits.slice(-2) : '??';
}
