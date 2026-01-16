const express = require('express');
const fs = require('fs');
const router = express.Router();

const { getFlowDefinitions, getOverridesPath } = require('../bot/flows/getFlowDefinitions');

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function sanitizeForJson(value) {
  if (typeof value === 'function') {
    return { __type: 'function', source: value.toString() };
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForJson);
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // JSON não serializa undefined
      if (v === undefined) continue;
      out[k] = sanitizeForJson(v);
    }
    return out;
  }
  return value;
}

function readOverrides() {
  const p = getOverridesPath();
  try {
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverrides(overrides) {
  const p = getOverridesPath();
  fs.mkdirSync(require('path').dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(overrides, null, 2), 'utf8');
}

function validateFlowShape(flowId, def) {
  if (!isPlainObject(def)) return 'Definição precisa ser um objeto';
  if (def.id && def.id !== flowId) return `Campo id (${def.id}) não bate com o flowId (${flowId})`;

  const hasSteps = !!def.steps;
  const hasOptions = !!def.options;

  if (hasSteps && !isPlainObject(def.steps)) return 'steps precisa ser um objeto';
  if (hasOptions && !isPlainObject(def.options)) return 'options precisa ser um objeto';

  if (!hasSteps && !hasOptions && def.message === undefined) {
    // permitir overrides parciais, mas para um flow "novo" isso seria inválido
    // aqui aceitamos mesmo assim; o flow base pode complementar.
  }

  // validar steps básicos
  if (hasSteps) {
    for (const [stepId, step] of Object.entries(def.steps)) {
      if (!isPlainObject(step)) return `step "${stepId}" precisa ser um objeto`;
      if (step.options && !isPlainObject(step.options)) return `step "${stepId}".options precisa ser um objeto`;
    }
  }

  return null;
}

/**
 * GET /api/bot-flows
 * Lista resumo dos fluxos efetivos do bot + indica quais possuem override.
 */
router.get('/', async (req, res) => {
  const { effective, overrides } = getFlowDefinitions();
  const list = Object.entries(effective).map(([id, def]) => ({
    id,
    name: def.name || id,
    type: def.steps ? 'steps' : 'simple',
    steps: def.steps ? Object.keys(def.steps) : [],
    hasOverride: !!overrides[id]
  }));
  list.sort((a, b) => a.id.localeCompare(b.id));
  return res.json({ success: true, data: { flows: list } });
});

/**
 * GET /api/bot-flows/:id
 * Retorna base/override/efetivo para edição.
 */
router.get('/:id', async (req, res) => {
  const flowId = req.params.id;
  const { base, overrides, effective } = getFlowDefinitions();
  const b = base[flowId] || null;
  const o = overrides[flowId] || null;
  const e = effective[flowId] || null;
  if (!e) return res.status(404).json({ success: false, message: 'Flow não encontrado' });
  return res.json({
    success: true,
    data: {
      id: flowId,
      base: b ? sanitizeForJson(b) : null,
      override: o ? sanitizeForJson(o) : null,
      effective: sanitizeForJson(e)
    }
  });
});

/**
 * PUT /api/bot-flows/:id
 * Salva override para um flow.
 * body: { override: { ... } }
 */
router.put('/:id', async (req, res) => {
  const flowId = req.params.id;
  const override = req.body?.override;

  if (!isPlainObject(override)) {
    return res.status(400).json({ success: false, message: 'Body inválido. Envie { override: { ... } }' });
  }

  const err = validateFlowShape(flowId, override);
  if (err) return res.status(400).json({ success: false, message: err });

  const all = readOverrides();
  all[flowId] = override;
  writeOverrides(all);

  return res.json({ success: true, data: { id: flowId }, message: 'Override salvo' });
});

/**
 * DELETE /api/bot-flows/:id/override
 * Remove override de um flow.
 */
router.delete('/:id/override', async (req, res) => {
  const flowId = req.params.id;
  const all = readOverrides();
  delete all[flowId];
  writeOverrides(all);
  return res.json({ success: true, data: { id: flowId }, message: 'Override removido' });
});

module.exports = router;


