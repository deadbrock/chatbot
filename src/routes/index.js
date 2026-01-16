const express = require('express');
const router = express.Router();

// Importar rotas
const ticketsRoutes = require('./tickets');
const sessionsRoutes = require('./sessions');
const usersRoutes = require('./users');
const analyticsRoutes = require('./analytics');
const webhookRoutes = require('./webhook');
const flowsRoutes = require('./flows');
const templatesRoutes = require('./templates');
const npsRoutes = require('./nps'); // NPS/Avaliações
const quickRepliesRoutes = require('./quickReplies'); // Respostas Rápidas
const tagsRoutes = require('./tags'); // Tags
const schedulesRoutes = require('./schedules'); // Agendamentos
const contactsRoutes = require('./contacts'); // Gestão de Contatos
const ticketStatusesRoutes = require('./ticketStatuses'); // Status Personalizados
const queuesRoutes = require('./queues'); // Filas de Atendimento
const campaignsRoutes = require('./campaigns'); // Campanhas de Mensagens em Massa
const broadcastsRoutes = require('./broadcasts'); // Transmissões (Broadcast)
const messageTemplatesAdvancedRoutes = require('./messageTemplatesAdvanced'); // Templates Avançados
const campaignFlowsRoutes = require('./campaignFlows'); // Fluxos de Campanha (Automações)
const followUpsRoutes = require('./followUps'); // Follow-ups Automáticos
const triggersRoutes = require('./triggers'); // Gatilhos e Ações
const apiKeysRoutes = require('./apiKeys'); // Gerenciamento de API Keys
const connectionsRoutes = require('./connections'); // Conexões WhatsApp
const settingsRoutes = require('./settings'); // Configurações do Sistema
const rolesRoutes = require('./roles'); // Papéis e Permissões
const chatRoutes = require('./chat'); // Chat em Tempo Real
const visualFlowsRoutes = require('./visualFlows'); // Editor Visual de Fluxos
const reportsRoutes = require('./reports'); // Relatórios e Exportações
const webhooksRoutes = require('./webhooks'); // Sistema de Webhooks
const dashboardRoutes = require('./dashboard'); // Dashboard Executivo
const performanceRoutes = require('./performance'); // Análise de Desempenho (Fase 6B)
const satisfactionRoutes = require('./satisfaction'); // Análise de Satisfação (Fase 6C)
const conversationRoutes = require('./conversation'); // Análise de Conversas (Fase 6D)
const whatsappRoutes = require('./whatsapp'); // Conexão WhatsApp
const conversationFlowsRoutes = require('./conversationFlows'); // Fluxos internos do bot (diagnóstico/config)
const botFlowsRoutes = require('./botFlows'); // Editor do fluxo do bot (base + overrides)
const aiRoutes = require('./ai'); // IA e Classificação de Intenções
const aiPlaygroundRoutes = require('./aiPlayground'); // AI Playground (Treinamento e Testes)

// Middleware de autenticação (implementar conforme necessário)
const authMiddleware = require('../middleware/auth');

// Rotas públicas
router.use('/webhook', webhookRoutes);
router.use('/users', usersRoutes);

// Rotas protegidas
router.use('/tickets', authMiddleware, ticketsRoutes);
router.use('/sessions', authMiddleware, sessionsRoutes);
router.use('/analytics', authMiddleware, analyticsRoutes);
router.use('/flows', authMiddleware, flowsRoutes);
router.use('/templates', authMiddleware, templatesRoutes);
router.use('/nps', authMiddleware, npsRoutes); // NPS/Avaliações
router.use('/quick-replies', authMiddleware, quickRepliesRoutes); // Respostas Rápidas
router.use('/tags', authMiddleware, tagsRoutes); // Tags
router.use('/schedules', authMiddleware, schedulesRoutes); // Agendamentos
router.use('/contacts', authMiddleware, contactsRoutes); // Gestão de Contatos
router.use('/ticket-statuses', authMiddleware, ticketStatusesRoutes); // Status Personalizados
router.use('/queues', authMiddleware, queuesRoutes); // Filas de Atendimento
router.use('/campaigns', authMiddleware, campaignsRoutes); // Campanhas de Mensagens em Massa
router.use('/broadcasts', authMiddleware, broadcastsRoutes); // Transmissões (Broadcast)
router.use('/message-templates-advanced', authMiddleware, messageTemplatesAdvancedRoutes); // Templates Avançados
router.use('/campaign-flows', authMiddleware, campaignFlowsRoutes); // Fluxos de Campanha (Automações)
router.use('/follow-ups', authMiddleware, followUpsRoutes); // Follow-ups Automáticos
router.use('/triggers', authMiddleware, triggersRoutes); // Gatilhos e Ações
router.use('/api-keys', authMiddleware, apiKeysRoutes); // Gerenciamento de API Keys
router.use('/connections', authMiddleware, connectionsRoutes); // Conexões WhatsApp
router.use('/settings', authMiddleware, settingsRoutes); // Configurações do Sistema
router.use('/roles', authMiddleware, rolesRoutes); // Papéis e Permissões
router.use('/chat', chatRoutes); // Chat em Tempo Real (auth dentro das rotas individuais)
router.use('/visual-flows', authMiddleware, visualFlowsRoutes); // Editor Visual de Fluxos
router.use('/reports', reportsRoutes); // Relatórios e Exportações (auth dentro das rotas)
router.use('/webhooks', webhooksRoutes); // Sistema de Webhooks (auth dentro das rotas)
router.use('/dashboard', dashboardRoutes); // Dashboard Executivo (auth dentro das rotas)
router.use('/performance', performanceRoutes); // Análise de Desempenho (Fase 6B)
router.use('/satisfaction', satisfactionRoutes); // Análise de Satisfação (Fase 6C)
router.use('/conversation', conversationRoutes); // Análise de Conversas (Fase 6D)
router.use('/whatsapp', whatsappRoutes); // Conexão WhatsApp
router.use('/conversation-flows', authMiddleware, conversationFlowsRoutes);
router.use('/bot-flows', authMiddleware, botFlowsRoutes);
router.use('/ai', authMiddleware, aiRoutes); // IA e Classificação de Intenções
router.use('/ai-playground', aiPlaygroundRoutes); // AI Playground (Treinamento e Testes) - auth dentro das rotas

// Rota de status
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

module.exports = router;

