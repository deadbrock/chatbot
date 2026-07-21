/**
 * Utilitários para mensagens de chat / WhatsApp
 */

function formatAgentWhatsAppMessage(agentName, body) {
  const text = String(body || '').trim();
  const name = String(agentName || 'Atendente').trim();
  if (!text) return '';
  return `*${name}:*\n${text}`;
}

function resolveMessageContactId({ contactId, conversation } = {}) {
  const conversationId = conversation?.id || null;
  const convContactId = conversation?.contactId || null;

  if (convContactId && convContactId !== conversationId) {
    return convContactId;
  }

  if (contactId && contactId !== conversationId) {
    return contactId;
  }

  return null;
}

module.exports = {
  formatAgentWhatsAppMessage,
  resolveMessageContactId
};
