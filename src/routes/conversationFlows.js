const express = require('express');
const router = express.Router();

/**
 * GET /api/conversation-flows
 * Lista os fluxos internos do bot (flowDefinitions) para configuração/diagnóstico.
 */
router.get('/', async (req, res) => {
  try {
    const botFlows = require('../bot/flows/flowDefinitions');

    const flows = Object.entries(botFlows).map(([id, def]) => ({
      id,
      name: def.name || id,
      type: def.steps ? 'steps' : 'simple',
      steps: def.steps ? Object.keys(def.steps) : [],
    }));

    flows.sort((a, b) => a.id.localeCompare(b.id));

    return res.json({ success: true, data: flows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar fluxos internos do bot',
      error: error.message
    });
  }
});

module.exports = router;


