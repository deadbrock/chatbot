const fs = require('fs');
const path = require('path');

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(base, override) {
  // Arrays e primitivos: override substitui
  if (Array.isArray(base) || Array.isArray(override)) return override;
  if (!isPlainObject(base) || !isPlainObject(override)) return override;

  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (k in base) out[k] = deepMerge(base[k], v);
    else out[k] = v;
  }
  return out;
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getOverridesPath() {
  // raiz do projeto: CWD costuma ser a raiz ao rodar o server
  return path.join(process.cwd(), 'data', 'bot-flow-overrides.json');
}

/**
 * Retorna as definições de fluxo efetivas do bot (base + overrides).
 * - Base vem de `flowDefinitions.js`
 * - Overrides são persistidos em `data/bot-flow-overrides.json`
 */
function getFlowDefinitions() {
  // Importar base (estático no código)
  const base = require('./flowDefinitions');
  const overrides = safeReadJson(getOverridesPath());

  const effective = {};
  for (const [flowId, flowDef] of Object.entries(base)) {
    const ov = overrides[flowId];
    effective[flowId] = ov ? deepMerge(flowDef, ov) : flowDef;
  }

  // Permitir override criar flows novos
  for (const [flowId, ov] of Object.entries(overrides)) {
    if (!effective[flowId]) effective[flowId] = ov;
  }

  return { base, overrides, effective };
}

module.exports = {
  getFlowDefinitions,
  getOverridesPath,
};


