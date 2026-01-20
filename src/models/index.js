/**
 * Importação centralizada de todos os modelos
 * Este arquivo garante que todos os modelos sejam carregados antes do sync
 */

// Modelos antigos (já existentes)
const User = require('./UserSQL');
const Ticket = require('./TicketSQL');
const Session = require('./SessionSQL');
const Flow = require('./FlowSQL');
const MessageTemplate = require('./MessageTemplateSQL');
const Rating = require('./RatingSQL');
const Tag = require('./TagSQL');
const TicketTag = require('./TicketTagSQL');
const Schedule = require('./ScheduleSQL');

// Novos modelos da Fase 1
const Contact = require('./ContactSQL');
const TicketStatus = require('./TicketStatusSQL');
const Queue = require('./QueueSQL');

// Novos modelos da Fase 2
const Campaign = require('./CampaignSQL');
const MessageTemplateAdvanced = require('./MessageTemplateAdvancedSQL');

// Novos modelos da Fase 3B - Administração
const ApiKey = require('./ApiKeySQL');
const WhatsAppConnection = require('./WhatsAppConnectionSQL');
const SystemSetting = require('./SystemSettingSQL');
const Role = require('./RoleSQL');

// Novos modelos da Fase 3C - Chat em Tempo Real
const ChatMessage = require('./ChatMessageSQL');
const Attachment = require('./AttachmentSQL');

// Novos modelos da Fase 3D - Editor Visual de Fluxos
const VisualFlow = require('./VisualFlowSQL');
const FlowNode = require('./FlowNodeSQL');

// Novos modelos da Fase 4A - Relatórios e Exportações
const Report = require('./ReportSQL');

// Novos modelos da Fase 6A - Dashboard Executivo
const AnalyticsSnapshot = require('./AnalyticsSnapshotSQL');

// Novos modelos da Fase 6B - Análise de Atendimento
const AgentPerformance = require('./AgentPerformanceSQL');
const QueuePerformance = require('./QueuePerformanceSQL');

// Novos modelos da Fase 6F - Custom Reports
const CustomReport = require('./CustomReportSQL');

// Novo modelo para Sistema de Fluxo de Chatbot
const UserSession = require('./UserSessionSQL');

module.exports = {
  // Modelos antigos
  User,
  Ticket,
  Session,
  Flow,
  MessageTemplate,
  Rating,
  Tag,
  TicketTag,
  Schedule,
  
  // Novos modelos Fase 1
  Contact,
  TicketStatus,
  Queue,
  
  // Novos modelos Fase 2
  Campaign,
  MessageTemplateAdvanced,
  
  // Novos modelos Fase 3B - Administração
  ApiKey,
  WhatsAppConnection,
  SystemSetting,
  Role,
  
  // Novos modelos Fase 3C - Chat em Tempo Real
  ChatMessage,
  Attachment,
  
  // Novos modelos Fase 3D - Editor Visual de Fluxos
  VisualFlow,
  FlowNode,
  
  // Novos modelos Fase 4A - Relatórios
  Report,
  
  // Novos modelos Fase 6A - Analytics
  AnalyticsSnapshot,
  
  // Novos modelos Fase 6B - Performance
  AgentPerformance,
  QueuePerformance,
  
  // Novos modelos Fase 6F - Custom Reports
  CustomReport,
  
  // Sistema de Fluxo de Chatbot
  UserSession
};

// Relacionamentos para Fase 3C
ChatMessage.hasMany(Attachment, {
  foreignKey: 'messageId',
  as: 'attachments'
});

Attachment.belongsTo(ChatMessage, {
  foreignKey: 'messageId',
  as: 'message'
});

