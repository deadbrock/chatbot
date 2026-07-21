/**
 * Notificações globais de tickets — funcionam em qualquer módulo do painel
 */
import { navigateToSection } from './router.js';
import { createToast } from './ui/toast.js';
import { escapeHtml } from './ui/dom.js';
import { resolveContactDisplayName } from './utils/contactDisplay.js';
import { getSocket } from './socket.js';
import { apiFetch } from './api.js';

let listenersReady = false;
const pendingItems = new Map();

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function normalizePendingItems(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function pendingNotificationKey(item = {}) {
  return String(item.ticketId || item.conversationId || item.id || '');
}

function isNotificationForCurrentUser(data = {}) {
  const user = getStoredUser();
  if (!user?.id) return false;

  if (user.role === 'admin') {
    return false;
  }

  const targetId = data.targetUserId || data.suggestedAgentId || data.agentId;
  if (targetId) {
    return Number(targetId) === Number(user.id);
  }

  return user.role === 'manager';
}

function playNotificationSound() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dtv24g');
    audio.play().catch(() => {});
  } catch (_) {
    // ignore
  }
}

function upsertPendingItem(item = {}) {
  const key = pendingNotificationKey(item);
  if (!key) return null;

  const conversation = item.conversation || {};
  pendingItems.set(key, {
    key,
    ticketId: item.ticketId || conversation.activeTicketId || null,
    conversationId: item.conversationId || conversation.id || null,
    protocol: item.protocol || conversation.activeTicket?.protocol || '',
    subject: item.subject || conversation.activeTicket?.subject || 'Atendimento pendente',
    message: item.message || item.waitingHumanReason || 'Aguardando aceite do atendimento',
    contactName: resolveContactDisplayName(conversation),
    assignedAt: item.assignedAt || null
  });

  return pendingItems.get(key);
}

function renderPendingTicketsPanel({ playSound = false } = {}) {
  const items = Array.from(pendingItems.values());
  const existing = document.getElementById('globalPendingTicketsPanel');
  if (existing) existing.remove();

  if (!items.length) return;

  const panel = document.createElement('div');
  panel.id = 'globalPendingTicketsPanel';
  panel.className = 'global-pending-tickets-panel position-fixed top-0 end-0 m-3 shadow';

  const rows = items.map((item) => {
    const safeConversationId = escapeHtml(item.conversationId || '');
    const safeTicketId = item.ticketId ? escapeHtml(String(item.ticketId)) : '';
    const subtitle = item.contactName || item.subject || 'Cliente aguardando';

    return `
      <div class="global-pending-ticket-item" data-pending-key="${escapeHtml(item.key)}">
        <div class="global-pending-ticket-copy">
          <strong>${escapeHtml(subtitle)}</strong>
          <span class="small text-muted d-block">${escapeHtml(item.subject || item.protocol || 'Ticket pendente')}</span>
          <span class="small text-muted d-block">${escapeHtml(item.message || '')}</span>
        </div>
        <button
          type="button"
          class="btn btn-success btn-sm"
          data-action="accept-ticket"
          data-conversation-id="${safeConversationId}"
          data-ticket-id="${safeTicketId}"
        >
          Aceitar
        </button>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <div class="global-pending-tickets-header">
      <div>
        <h6 class="mb-0"><i class="bi bi-bell-fill"></i> Atendimentos pendentes</h6>
        <small class="text-muted">${items.length} ticket(s) aguardando aceite</small>
      </div>
      <button type="button" class="btn-close" data-action="dismiss-pending-panel" aria-label="Fechar"></button>
    </div>
    <div class="global-pending-tickets-list">
      ${rows}
    </div>
    <div class="global-pending-tickets-footer">
      <button type="button" class="btn btn-outline-primary btn-sm w-100" data-action="open-chat-module">
        Abrir módulo de Chat
      </button>
    </div>
  `;

  panel.querySelector('[data-action="dismiss-pending-panel"]')?.addEventListener('click', () => {
    panel.remove();
  });

  panel.querySelector('[data-action="open-chat-module"]')?.addEventListener('click', () => {
    navigateToSection('chat');
  });

  panel.querySelectorAll('[data-action="accept-ticket"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const conversationId = button.dataset.conversationId;
      const ticketId = button.dataset.ticketId || null;
      const row = button.closest('.global-pending-ticket-item');
      const key = row?.dataset?.pendingKey;
      if (key) pendingItems.delete(key);
      row?.remove();

      if (!pendingItems.size) {
        panel.remove();
      } else {
        const countEl = panel.querySelector('.global-pending-tickets-header small');
        if (countEl) {
          countEl.textContent = `${pendingItems.size} ticket(s) aguardando aceite`;
        }
      }

      await acceptTicketAndGoToChat(conversationId, ticketId);
    });
  });

  document.body.appendChild(panel);

  if (playSound) {
    playNotificationSound();
  }
}

function notifyPendingCount() {
  window.dispatchEvent(new CustomEvent('tickets:pending_updated', {
    detail: { count: pendingItems.size, items: Array.from(pendingItems.values()) }
  }));
}

export function getPendingTicketsCount() {
  return pendingItems.size;
}

export function showConversationWaitingNotification(data = {}) {
  if (!isNotificationForCurrentUser(data)) return;

  const conversation = data.conversation || {};
  upsertPendingItem({
    conversationId: conversation.id,
    conversation,
    ticketId: data.ticketId || conversation.activeTicketId,
    subject: data.message || data.subject,
    message: data.message || data.subject || 'Nova solicitação de atendimento',
    targetUserId: data.targetUserId || data.suggestedAgentId
  });
  renderPendingTicketsPanel({ playSound: true });
  notifyPendingCount();
}

export function showTicketAssignedNotification(data = {}) {
  if (!isNotificationForCurrentUser(data)) return;

  upsertPendingItem({
    conversationId: data.conversationId || data.conversation?.id,
    conversation: data.conversation,
    ticketId: data.ticketId,
    subject: data.subject,
    protocol: data.protocol,
    message: data.message || 'Um cliente foi direcionado para sua fila.',
    targetUserId: data.targetUserId || data.suggestedAgentId
  });
  renderPendingTicketsPanel({ playSound: true });
  notifyPendingCount();

  createToast({
    title: 'Novo atendimento',
    message: data.subject || data.protocol || 'Ticket atribuído a você',
    variant: 'info'
  });
}

export async function acceptTicketAndGoToChat(conversationId, ticketId = null) {
  if (!conversationId) {
    createToast({ title: 'Erro', message: 'Conversa não identificada.', variant: 'warning' });
    return;
  }

  navigateToSection('chat');

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (typeof window.__chatAcceptAndOpen === 'function') {
      await window.__chatAcceptAndOpen(conversationId, ticketId);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  createToast({
    title: 'Chat',
    message: 'Abra o módulo Chat em Tempo Real para aceitar o atendimento.',
    variant: 'warning'
  });
}

export async function loadPendingTicketNotifications({ reset = true } = {}) {
  const user = getStoredUser();
  if (!user?.id || user.role === 'admin') return [];

  try {
    const response = await apiFetch('/conversations/pending');
    const items = normalizePendingItems(response);

    if (reset) {
      pendingItems.clear();
    }

    for (const item of items) {
      upsertPendingItem({
        ...item,
        targetUserId: user.id,
        suggestedAgentId: user.id
      });
    }

    renderPendingTicketsPanel({ playSound: items.length > 0 && !reset });
    notifyPendingCount();

    if (items.length > 0) {
      createToast({
        title: 'Atendimentos pendentes',
        message: `Você tem ${items.length} ticket(s) aguardando aceite.`,
        variant: 'info'
      });
    }

    return items;
  } catch (error) {
    console.warn('Falha ao carregar tickets pendentes:', error);
    return [];
  }
}

export function initGlobalTicketNotifications() {
  if (listenersReady) {
    loadPendingTicketNotifications();
    return;
  }
  listenersReady = true;

  window.acceptTicketFromNotification = (conversationId, ticketId) =>
    acceptTicketAndGoToChat(conversationId, ticketId);
  window.loadPendingTicketNotifications = loadPendingTicketNotifications;

  window.addEventListener('realtime:new_conversation_notification', (event) => {
    showConversationWaitingNotification(event.detail || {});
  });

  window.addEventListener('realtime:ticket_assigned_to_you', (event) => {
    showTicketAssignedNotification(event.detail || {});
  });

  const bindSocketListeners = () => {
    const socket = getSocket();
    if (!socket || socket.__ticketNotificationsBound) return;

    socket.__ticketNotificationsBound = true;
    socket.on('new_conversation_notification', (data) => {
      showConversationWaitingNotification(data);
      window.dispatchEvent(new CustomEvent('realtime:new_conversation_notification', { detail: data }));
    });
    socket.on('ticket_assigned_to_you', (data) => {
      showTicketAssignedNotification(data);
      window.dispatchEvent(new CustomEvent('realtime:ticket_assigned_to_you', { detail: data }));
    });
    socket.on('authenticated', () => {
      loadPendingTicketNotifications();
    });
    socket.on('connect', () => {
      setTimeout(() => loadPendingTicketNotifications({ reset: false }), 500);
    });
  };

  bindSocketListeners();
  window.addEventListener('socket:ready', bindSocketListeners);

  loadPendingTicketNotifications();
}
