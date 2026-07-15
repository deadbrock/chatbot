require('dotenv').config();

/**
 * Controle de respostas automáticas do WhatsApp.
 * false (padrão): apenas recebe mensagens e encaminha ao painel — atendimento 100% manual.
 * true: habilita fluxos, automações e IA no primeiro atendimento.
 */
const isAutoReplyEnabled = process.env.BOT_AUTO_REPLY === 'true';

module.exports = {
  isAutoReplyEnabled
};
