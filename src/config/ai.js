require('dotenv').config();

const GROQ_KEY_PATTERN = /^gsk_[a-zA-Z0-9]+/;

const DIRECT_KEY_ENV_NAMES = [
  'GROQ_API_KEY',
  'GROK_API_KEY',
  'GROQ_KEY',
  'GROK',
  'Grok',
  'GROQ',
  'AI_API_KEY',
  'AI_GROQ_KEY',
  'GROQ_API',
  'GROK_API'
];

/**
 * Resolve a chave da API Groq.
 * Tenta nomes conhecidos e, em seguida, qualquer variável cujo valor comece com gsk_.
 */
function resolveGroqApiKey() {
  for (const name of DIRECT_KEY_ENV_NAMES) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (GROQ_KEY_PATTERN.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

function resolveGroqApiKeySource() {
  for (const name of DIRECT_KEY_ENV_NAMES) {
    if (process.env[name]?.trim()) return name;
  }

  for (const [name, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && GROQ_KEY_PATTERN.test(value.trim())) {
      return name;
    }
  }

  return null;
}

/**
 * Respostas automáticas (fluxos + IA).
 * Ativo por padrão. Desative apenas com BOT_AUTO_REPLY=false.
 */
function isAutoReplyEnabled() {
  const flag = String(process.env.BOT_AUTO_REPLY || '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return true;
}

function isAIEnabled(configEnabled = true) {
  return isAutoReplyEnabled() && configEnabled !== false && Boolean(resolveGroqApiKey());
}

function getAutoReplyDiagnostics() {
  const flag = process.env.BOT_AUTO_REPLY;
  const key = resolveGroqApiKey();
  const keySource = resolveGroqApiKeySource();

  if (!isAutoReplyEnabled()) {
    return {
      enabled: false,
      reason: `BOT_AUTO_REPLY=${flag ?? 'false'}`
    };
  }

  return {
    enabled: true,
    reason: key
      ? `ativas (Groq via ${keySource || 'env'})`
      : 'ativas (fluxos/boas-vindas; IA aguardando chave gsk_...)'
  };
}

module.exports = {
  resolveGroqApiKey,
  resolveGroqApiKeySource,
  isAutoReplyEnabled,
  isAIEnabled,
  getAutoReplyDiagnostics
};
