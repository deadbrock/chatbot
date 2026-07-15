/**
 * CHAT VIEW - Interface de Chat em Tempo Real
 * Socket.IO + Mensagens + Upload de Arquivos
 */

import { apiFetch } from '../api.js';
import { showToast, createToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';
import { getSocket, connectSocket, requestNotificationPermission, getNotificationPermission, onSocketEvent } from '../socket.js';
import { resolveContactDisplayName, getContactInitials, formatPhoneDisplay, normalizePhoneDigits } from '../utils/contactDisplay.js';
import { debounce } from '../ui/dom.js';

// Socket.IO
let socket = null;
let currentConversationId = null;
let currentConversation = null;
let currentTicketId = null;
let currentUserId = null;
let typingTimeout = null;
let selectedFile = null;
let cachedTickets = [];
let chatRealtimeReady = false;
let chatPollInterval = null;
let voiceRecorder = null;
let voiceChunks = [];
let isRecordingVoice = false;
const notifiedMessageIds = new Set();
let currentChatFilter = 'all';
let currentSearchText = '';
const CHAT_LIST_PAGE_SIZE = 50;
let chatListPage = 1;
let chatListPagination = { total: 0, pages: 1, hasMore: false };
let chatListStats = { all: 0, unread: 0, open: 0 };
const CHAT_MESSAGES_PAGE_SIZE = 200;
let currentTicketMessages = [];
let hasMoreOlderMessages = false;
let loadingOlderMessages = false;
let chatUiListenersReady = false;
let messageSearchMatches = [];
let messageSearchIndex = -1;

/**
 * Registra listeners de tempo real (chamado no login do app)
 */
export function registerChatRealtime() {
  if (chatRealtimeReady) return;

  socket = connectSocket();
  if (!socket) return;

  onSocketEvent('new_message', handleNewMessage);
  onSocketEvent('conversation_updated', () => refreshChatListSilently());

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateGlobalUnreadBadge();
      if ((location.hash || '').includes('chat')) {
        refreshChatListSilently();
        if (currentConversationId) refreshOpenChatMessages();
      }
    }
  });

  socket.on('message_sent', (data) => {
    const message = data.message || data;
    if (sameConversationId(data.conversationId, currentConversationId)
      || sameTicketId(data.ticketId || message.ticketId, currentTicketId)) {
      updateMessageInChat(message);
    }
    refreshChatListSilently();
  });

  socket.on('whatsapp_sync_complete', (data) => {
    if (data?.success) {
      const ensured = data.stats?.conversationsEnsured || data.stats?.ticketsEnsured || data.stats?.chatsProcessed || 0;
      const imported = data.stats?.messagesImported || 0;
      const updated = data.stats?.messagesUpdated || 0;
      const synced = imported + updated;
      const created = data.stats?.ticketsCreated || 0;
      showToast(
        `WhatsApp sincronizado: ${ensured} conversas${created ? ` (${created} novas)` : ''}, ${synced} mensagens`,
        'success'
      );
      loadChats({ silent: true, page: 1 });
    } else if (data?.error) {
      showToast(`Erro na sincronização: ${data.error}`, 'error');
    }
  });

  socket.on('new_conversation_notification', (data) => {
    showConversationNotification(data);
    loadChats({ silent: true });
  });

  socket.on('conversations_purged', () => {
    cachedTickets = [];
    currentConversationId = null;
    currentTicketId = null;
    currentTicketMessages = [];
    hasMoreOlderMessages = false;
    document.getElementById('chatList')?.replaceChildren();
    document.getElementById('chatListPagination')?.replaceChildren();
    document.getElementById('chatEmptyState')?.style && (document.getElementById('chatEmptyState').style.display = 'flex');
    document.getElementById('chatHeader')?.style && (document.getElementById('chatHeader').style.display = 'none');
    document.getElementById('chatMessages')?.style && (document.getElementById('chatMessages').style.display = 'none');
    document.getElementById('chatInput')?.style && (document.getElementById('chatInput').style.display = 'none');
    loadChats({ silent: true, page: 1 });
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  currentUserId = user.id;
  const authPayload = {
    token: localStorage.getItem('token'),
    userId: user.id,
    name: user.name,
    role: user.role
  };

  const doAuth = () => socket.emit('authenticate', authPayload);
  if (socket.connected) doAuth();
  else socket.once('connect', doAuth);

  startChatPolling();
  setupNotificationButton();
  chatRealtimeReady = true;
  updateGlobalUnreadBadge();
}

let notificationButtonReady = false;

function setupNotificationButton() {
  if (notificationButtonReady) return;
  const btn = document.getElementById('enableNotificationsBtn');
  if (!btn) return;
  notificationButtonReady = true;

  const updateBtn = () => {
    const perm = getNotificationPermission();
    if (perm === 'unsupported' || perm === 'granted' || perm === 'denied') {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    btn.title = 'Clique para ativar notificações do navegador';
  };

  updateBtn();

  btn.addEventListener('click', async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      showToast('Notificações ativadas!', 'success');
    } else if (getNotificationPermission() === 'denied') {
      showToast('Notificações bloqueadas. Libere nas configurações do navegador.', 'warning');
    }
    updateBtn();
  });
}

export async function initChatView() {
  console.log('🎨 Inicializando Chat View...');

  mountMediaViewer();
  registerChatRealtime();
  setupNotificationButton();

  await loadChats();
  setupEventListeners();
  setupChatUiSocketEvents();

  window.acceptConversation = acceptConversation;
  window.finishConversation = finishConversation;
  window.acceptTicketFromNotification = acceptConversationFromNotification;

  console.log('✅ Chat View inicializado');
}

function setupChatUiSocketEvents() {
  if (!socket) return;

  socket.off('message_read');
  socket.off('message_reaction');
  socket.off('user_typing');
  socket.off('user_stop_typing');
  socket.off('user_online');
  socket.off('user_offline');

  socket.on('message_read', (data) => {
    updateMessageStatus(data.messageId, 'read');
  });

  socket.on('message_reaction', (data) => {
    handleMessageReaction(data);
  });

  socket.on('user_typing', (data) => {
    showTypingIndicator(data);
  });

  socket.on('user_stop_typing', () => {
    hideTypingIndicator();
  });

  socket.on('user_online', (data) => {
    updateUserStatus(data.userId, 'online');
  });

  socket.on('user_offline', (data) => {
    updateUserStatus(data.userId, 'offline');
  });
}

function startChatPolling() {
  if (chatPollInterval) return;
  chatPollInterval = setInterval(() => {
    if (document.hidden) return;

    updateGlobalUnreadBadge();

    if (!(location.hash || '').includes('chat')) return;

    refreshChatListSilently();
    if (currentConversationId) {
      refreshOpenChatMessages();
    }
  }, 8000);
}

async function refreshOpenChatMessages() {
  if (!currentConversationId) return;
  try {
    const response = await loadConversationMessages(currentConversationId);
    const messages = response?.messages || [];
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const currentCount = container.querySelectorAll('.chat-message').length;
    if (messages.length > currentCount) {
      currentTicketMessages = messages;
      renderMessages(messages, { scrollToBottom: true });
    }
  } catch (error) {
    console.debug('Polling mensagens:', error.message);
  }
}

async function loadConversationMessages(conversationId, { before } = {}) {
  const params = new URLSearchParams({ limit: String(CHAT_MESSAGES_PAGE_SIZE) });
  if (before) params.set('before', before);
  return apiFetch(`/chat/conversations/${conversationId}/messages?${params.toString()}`);
}

async function loadTicketMessages(ticketId, { before } = {}) {
  const params = new URLSearchParams({ limit: String(CHAT_MESSAGES_PAGE_SIZE) });
  if (before) params.set('before', before);
  return apiFetch(`/chat/tickets/${ticketId}/messages?${params.toString()}`);
}

async function loadOlderMessages() {
  if (!currentConversationId || !hasMoreOlderMessages || loadingOlderMessages) return;

  const oldest = currentTicketMessages[0];
  if (!oldest?.timestamp) return;

  loadingOlderMessages = true;
  const container = document.getElementById('chatMessages');
  const previousHeight = container?.scrollHeight || 0;

  try {
    const response = await loadConversationMessages(currentConversationId, {
      before: new Date(oldest.timestamp).toISOString()
    });
    const olderMessages = response?.messages || [];
    if (!olderMessages.length) {
      hasMoreOlderMessages = false;
      return;
    }

    currentTicketMessages = [...olderMessages, ...currentTicketMessages];
    hasMoreOlderMessages = Boolean(response?.hasMore);
    renderMessages(currentTicketMessages, { scrollToBottom: false, preserveScroll: true, previousHeight });
  } catch (error) {
    console.error('Erro ao carregar mensagens antigas:', error);
  } finally {
    loadingOlderMessages = false;
  }
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
  if (chatUiListenersReady) return;
  chatUiListenersReady = true;

  // Busca de conversas
  const searchInput = document.getElementById('chatSearchInput');
  searchInput?.addEventListener('input', debounce((e) => {
    filterChats(e.target.value);
  }, 300));
  
  // Filtros
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const button = e.currentTarget;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      filterChatsByStatus(button.dataset.filter);
    });
  });
  
  // Refresh
  document.getElementById('refreshChatsBtn')?.addEventListener('click', () => loadChats({ page: chatListPage }));
  
  // Enviar mensagem
  const sendBtn = document.getElementById('sendMessageBtn');
  sendBtn?.addEventListener('click', sendMessage);
  
  // Textarea - Enter para enviar
  const textarea = document.getElementById('messageTextarea');
  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Textarea - Indicador de digitação
  textarea?.addEventListener('input', () => {
    handleTyping();
    autoResizeTextarea(textarea);
  });
  
  // Anexar arquivo
  document.getElementById('attachFileBtn')?.addEventListener('click', () => {
    document.getElementById('fileInput')?.click();
  });
  
  document.getElementById('fileInput')?.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
  });
  
  document.getElementById('removeFileBtn')?.addEventListener('click', () => {
    clearFileSelection();
  });

  document.getElementById('recordVoiceBtn')?.addEventListener('click', toggleVoiceRecording);

  // Evento global para abrir chat de um ticket específico
  window.addEventListener('openChat', (event) => {
    const conversationId = event?.detail?.conversationId || event?.detail?.ticketId;
    if (conversationId) {
      console.log('🎯 Abrindo conversa:', conversationId);
      openChat(conversationId);
    }
  });
  
  // Painel de informações e ações do cabeçalho do chat
  document.getElementById('chatInfoToggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeChatMenu();
    toggleInfoPanel();
  });

  document.getElementById('closeInfoPanel')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleInfoPanel(false);
  });

  document.getElementById('chatSearchToggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeChatMenu();
    toggleMessageSearchBar();
  });

  document.getElementById('chatMessageSearchClose')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleMessageSearchBar(false);
  });

  document.getElementById('chatMessageSearchInput')?.addEventListener('input', debounce((e) => {
    searchMessagesInChat(e.target.value);
  }, 200));

  document.getElementById('chatMessageSearchPrev')?.addEventListener('click', (e) => {
    e.preventDefault();
    goToMessageSearchMatch(messageSearchIndex - 1);
  });

  document.getElementById('chatMessageSearchNext')?.addEventListener('click', (e) => {
    e.preventDefault();
    goToMessageSearchMatch(messageSearchIndex + 1);
  });

  document.getElementById('chatMenuToggle')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleChatMenu();
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('chatHeaderDropdown');
    const toggle = document.getElementById('chatMenuToggle');
    if (!menu || !toggle) return;
    if (!menu.contains(e.target) && !toggle.contains(e.target)) {
      closeChatMenu();
    }
  });

  document.getElementById('chatCloseBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeChatMenu();
    finishCurrentChat();
  });

  document.getElementById('chatArchiveBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeChatMenu();
    archiveTicket();
  });

  document.getElementById('chatBlockBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeChatMenu();
    blockContact();
  });

  document.getElementById('chatSaveContactBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeChatMenu();
    saveContactFromChat();
  });

  document.getElementById('chatMessages')?.addEventListener('click', handleMediaClick);
  document.getElementById('mediaViewer')?.addEventListener('click', handleMediaViewerBackdrop);
  document.getElementById('mediaViewerClose')?.addEventListener('click', closeMediaViewer);
  document.getElementById('mediaViewerDownload')?.addEventListener('click', (e) => e.stopPropagation());
  document.getElementById('mediaViewerOpen')?.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMediaViewer();
  });

  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer?.addEventListener('scroll', () => {
    if (!messagesContainer || loadingOlderMessages || !hasMoreOlderMessages) return;
    if (messagesContainer.scrollTop < 120) {
      loadOlderMessages();
    }
  });
}

/**
 * Carrega lista de conversas (paginada)
 */
async function loadChats({ silent = false, page = chatListPage } = {}) {
  try {
    if (!silent) showLoading();

    const params = new URLSearchParams({
      limit: String(CHAT_LIST_PAGE_SIZE),
      page: String(page),
      filter: currentChatFilter,
      search: currentSearchText
    });

    const response = await apiFetch(`/conversations?${params.toString()}`);
    const ticketsArray = Array.isArray(response)
      ? response
      : (response?.data || []);

    chatListPage = response?.pagination?.page || page;
    chatListPagination = {
      total: response?.pagination?.total || ticketsArray.length,
      pages: response?.pagination?.pages || 1,
      hasMore: Boolean(response?.pagination?.hasMore)
    };

    if (response?.stats) {
      chatListStats = response.stats;
    }

    cachedTickets = sortTicketsByRecent(ticketsArray);
    updateFilterCounts(chatListStats);
    renderChatList(cachedTickets);
    renderChatListPagination();
  } catch (error) {
    console.error('❌ Erro ao carregar conversas:', error);
    if (!silent) showToast('Erro ao carregar conversas', 'error');
  } finally {
    if (!silent) hideLoading();
  }
}

function renderChatListPagination() {
  const paginationEl = document.getElementById('chatListPagination');
  if (!paginationEl) return;

  const { total, pages } = chatListPagination;
  if (!total) {
    paginationEl.innerHTML = '';
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = '';
  const start = (chatListPage - 1) * CHAT_LIST_PAGE_SIZE + 1;
  const end = Math.min(chatListPage * CHAT_LIST_PAGE_SIZE, total);

  paginationEl.innerHTML = `
    <button type="button" class="chat-page-btn" id="chatListPrevBtn" ${chatListPage <= 1 ? 'disabled' : ''} title="Página anterior">
      <i class="bi bi-chevron-left"></i>
    </button>
    <div class="chat-page-info">
      <span class="chat-page-label">Página ${chatListPage} de ${pages}</span>
      <span class="chat-page-range">${start}–${end} de ${total}</span>
    </div>
    <button type="button" class="chat-page-btn" id="chatListNextBtn" ${chatListPage >= pages ? 'disabled' : ''} title="Próxima página">
      <i class="bi bi-chevron-right"></i>
    </button>
  `;

  document.getElementById('chatListPrevBtn')?.addEventListener('click', () => {
    if (chatListPage > 1) loadChats({ page: chatListPage - 1 });
  });
  document.getElementById('chatListNextBtn')?.addEventListener('click', () => {
    if (chatListPage < pages) loadChats({ page: chatListPage + 1 });
  });
}

function sortTicketsByRecent(tickets) {
  return [...tickets].sort((a, b) => {
    const tsA = new Date(a.lastMessage?.timestamp || a.updatedAt || 0).getTime();
    const tsB = new Date(b.lastMessage?.timestamp || b.updatedAt || 0).getTime();
    return tsB - tsA;
  });
}

async function refreshChatListSilently() {
  await loadChats({ silent: true });
  if (currentConversationId) {
    document.querySelector(`[data-conversation-id="${currentConversationId}"]`)?.classList.add('active');
  }
}

/**
 * Monta HTML do avatar com foto ou iniciais
 */
function buildAvatarInnerHtml(profilePicUrl, displayName, phone) {
  const initials = getContactInitials(displayName, phone);
  if (profilePicUrl) {
    return `
      <img src="${escapeHtml(profilePicUrl)}" class="chat-avatar-img" alt="" loading="lazy" onerror="this.remove()">
      <span class="chat-avatar-fallback">${initials}</span>
    `;
  }
  return `<span>${initials}</span>`;
}

/**
 * Aplica foto de perfil no cabeçalho do chat
 */
function applyHeaderAvatar(conversation) {
  const phone = conversation.contact?.phone || conversation.userPhone || conversation.whatsappJid || '';
  const contactName = conversation.displayName || resolveContactDisplayName(conversation);
  const profilePicUrl = conversation.contact?.profilePicUrl || null;
  const initials = getContactInitials(contactName, phone);

  const imgEl = document.getElementById('chatContactAvatarImg');
  const initialsEl = document.getElementById('chatContactInitials');

  if (imgEl && profilePicUrl) {
    imgEl.src = profilePicUrl;
    imgEl.style.display = 'block';
    imgEl.onerror = () => {
      imgEl.style.display = 'none';
      imgEl.removeAttribute('src');
      if (initialsEl) {
        initialsEl.textContent = initials;
        initialsEl.style.display = '';
      }
    };
    if (initialsEl) {
      initialsEl.textContent = initials;
      initialsEl.style.display = 'none';
    }
    return;
  }

  if (imgEl) {
    imgEl.style.display = 'none';
    imgEl.removeAttribute('src');
  }
  if (initialsEl) {
    initialsEl.textContent = initials;
    initialsEl.style.display = '';
  }
}

/**
 * Atualiza visibilidade do menu "Salvar contato"
 */
function updateSaveContactMenu(conversation) {
  const item = document.getElementById('chatSaveContactItem');
  if (!item) return;

  const source = conversation?.contact?.source;
  const isSaved = source === 'Manual';
  item.style.display = isSaved ? 'none' : '';
}

/**
 * Renderiza lista de conversas
 */
function renderChatList(tickets) {
  const chatList = document.getElementById('chatList');
  if (!chatList) return;
  
  if (!tickets || tickets.length === 0) {
    const emptyMessages = {
      all: 'Nenhuma conversa ativa',
      unread: 'Nenhuma conversa não lida',
      open: 'Nenhuma conversa aberta'
    };
    const emptyText = emptyMessages[currentChatFilter] || emptyMessages.all;

    chatList.innerHTML = `
      <div class="chat-list-empty">
        <i class="bi bi-chat-dots"></i>
        <p>${emptyText}</p>
      </div>
    `;
    return;
  }
  
  chatList.innerHTML = tickets.map(ticket => {
    const contact = ticket.contact || {};
    const lastMessage = ticket.lastMessage || {};
    const unreadCount = ticket.unreadMessages || 0;
    const displayName = ticket.displayName || resolveContactDisplayName(ticket);
    const phone = ticket.contact?.phone || ticket.userPhone || '';
    const profilePicUrl = ticket.contact?.profilePicUrl || null;
    const preview = formatMessagePreview(lastMessage);
    
    return `
      <div class="chat-item ${unreadCount > 0 ? 'unread' : ''}" data-conversation-id="${ticket.id}">
        <div class="chat-item-avatar">
          ${buildAvatarInnerHtml(profilePicUrl, displayName, phone)}
          ${ticket.activeTicket?.status === 'in_progress' ? '<span class="status-indicator online"></span>' : ''}
        </div>
        <div class="chat-item-content">
          <div class="chat-item-top">
            <h6 class="chat-item-name">${escapeHtml(displayName)}</h6>
            <span class="chat-item-time">${formatTime(lastMessage.timestamp || ticket.updatedAt)}</span>
          </div>
          <div class="chat-item-bottom">
            <p class="chat-item-preview">${escapeHtml(preview)}</p>
            ${unreadCount > 0 ? `<span class="chat-item-unread">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Event listeners para cada item
  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const conversationId = item.dataset.conversationId;
      openChat(conversationId);
    });
  });
}

/**
 * Abre um chat
 */
async function openChat(conversationId) {
  try {
    showLoading();
    
    if (currentConversationId && socket) {
      socket.emit('leave_conversation', currentConversationId);
    }
    if (currentTicketId && socket) {
      socket.emit('leave_ticket', currentTicketId);
    }
    
    currentConversationId = conversationId;
    currentTicketId = null;
    currentTicketMessages = [];
    hasMoreOlderMessages = false;
    toggleMessageSearchBar(false);
    toggleInfoPanel(false);
    closeChatMenu();

    const messagesResponse = await loadConversationMessages(conversationId);
    const messages = messagesResponse?.messages || [];
    hasMoreOlderMessages = Boolean(messagesResponse?.hasMore);
    currentTicketMessages = messages;
    
    const conversation = await apiFetch(`/conversations/${conversationId}`);
    currentConversation = conversation;
    currentTicketId = conversation?.activeTicketId || conversation?.activeTicket?.id || messagesResponse?.activeTicketId || null;
    
    renderChatHeader(conversation);
    renderMessages(messages, { scrollToBottom: true });
    
    document.getElementById('chatEmptyState').style.display = 'none';
    document.getElementById('chatHeader').style.display = 'flex';
    document.getElementById('chatMessages').style.display = 'flex';
    document.getElementById('chatInput').style.display = 'block';
    
    document.querySelectorAll('.chat-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-conversation-id="${conversationId}"]`)?.classList.add('active');
    
    if (socket) {
      socket.emit('join_conversation', conversationId);
      if (currentTicketId) {
        socket.emit('join_ticket', currentTicketId);
      }
    }
    
    await markMessagesAsRead(conversationId);
    
    hideLoading();
  } catch (error) {
    console.error('❌ Erro ao abrir chat:', error);
    showToast('Erro ao abrir conversa', 'error');
    hideLoading();
  }
}

/**
 * Renderiza cabeçalho do chat
 */
function renderChatHeader(conversation) {
  const phone = conversation.contact?.phone || conversation.userPhone || conversation.whatsappJid || '';
  const contactName = conversation.displayName || resolveContactDisplayName(conversation);
  const formattedPhone = formatPhoneDisplay(phone);
  const activeTicket = conversation.activeTicket || null;
  const queueName = activeTicket?.department || '-';
  const agentName = activeTicket?.assignedAgent?.name || (activeTicket?.assignedTo ? 'Atendente' : 'Não atribuído');
  const statusLabel = activeTicket
    ? getStatusLabel(activeTicket.status)
    : (conversation.waitingHuman ? 'Aguardando atendente' : 'Conversa');
  
  const initialsEl = document.getElementById('chatContactInitials');
  if (initialsEl && !conversation.contact?.profilePicUrl) {
    initialsEl.textContent = getContactInitials(contactName, phone);
  }

  applyHeaderAvatar(conversation);
  updateSaveContactMenu(conversation);
  
  const nameEl = document.getElementById('chatContactName');
  if (nameEl) nameEl.textContent = contactName;
  
  const infoEl = document.getElementById('chatContactInfo');
  if (infoEl) {
    const parts = [];
    const showingPhoneAsName = normalizePhoneDigits(contactName) === normalizePhoneDigits(phone);
    if (formattedPhone && !showingPhoneAsName) parts.push(formattedPhone);
    parts.push(statusLabel);
    infoEl.textContent = parts.join(' · ');
  }
  
  // Status indicator
  const statusIndicator = document.getElementById('chatContactStatus');
  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${activeTicket?.status === 'in_progress' ? 'online' : 'offline'}`;
  }
  
  // Painel de informações
  const infoNameEl = document.getElementById('infoContactName');
  if (infoNameEl) infoNameEl.textContent = contactName;
  
  const infoPhoneEl = document.getElementById('infoContactPhone');
  if (infoPhoneEl) infoPhoneEl.textContent = formattedPhone || phone.split('@')[0] || '-';
  
  const infoStatusEl = document.getElementById('infoTicketStatus');
  if (infoStatusEl) infoStatusEl.textContent = statusLabel;
  
  const infoQueueEl = document.getElementById('infoTicketQueue');
  if (infoQueueEl) infoQueueEl.textContent = queueName;
  
  const infoAgentEl = document.getElementById('infoTicketAgent');
  if (infoAgentEl) infoAgentEl.textContent = agentName;
  
  const infoTagsEl = document.getElementById('infoTicketTags');
  if (infoTagsEl && activeTicket?.tags && activeTicket.tags.length > 0) {
    infoTagsEl.innerHTML = activeTicket.tags.map(tag => 
      `<span class="badge" style="background-color: ${tag.color}">${tag.name}</span>`
    ).join(' ');
  }
  
  renderActionButtons(conversation);
}

/**
 * Renderiza botões de ação no cabeçalho (Aceitar, Rejeitar, Finalizar)
 */
function renderActionButtons(conversation) {
  const actionsContainer = document.getElementById('chatHeaderActions');
  if (!actionsContainer) return;
  
  actionsContainer.innerHTML = '';
  
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const activeTicket = conversation.activeTicket || null;
  const conversationId = conversation.id;

  if (!activeTicket) {
    actionsContainer.innerHTML = `
      <button class="btn btn-success btn-sm" onclick="acceptConversation('${conversationId}')" title="Aceitar Atendimento">
        <i class="bi bi-check-circle"></i> Aceitar
      </button>
    `;
  }

  if (activeTicket?.status === 'in_progress' && activeTicket.assignedTo === currentUser.id) {
    actionsContainer.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="finishConversation('${conversationId}')" title="Finalizar Atendimento">
        <i class="bi bi-check2-all"></i> Finalizar Atendimento
      </button>
    `;
  }
}

/**
 * Renderiza mensagens (Estilo WhatsApp)
 */
function renderMessages(messages, { scrollToBottom = true, preserveScroll = false, previousHeight = 0 } = {}) {
  const messagesContainer = document.getElementById('chatMessages');

  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="chat-system-message">
        <div class="system-message-content">
          <i class="bi bi-chat-square-text"></i> Nenhuma mensagem ainda
        </div>
      </div>
    `;
    return;
  }

  const loadMoreHint = hasMoreOlderMessages
    ? `<div class="chat-load-more-hint" id="chatLoadMoreHint"><i class="bi bi-arrow-up"></i> Role para cima para ver mensagens mais antigas</div>`
    : '';

  messagesContainer.innerHTML = `${loadMoreHint}${messages.map((msg) => renderMessage(msg)).join('')}`;
  enhanceChatImages();

  if (preserveScroll && messagesContainer) {
    const newHeight = messagesContainer.scrollHeight;
    messagesContainer.scrollTop = newHeight - previousHeight;
    return;
  }

  if (scrollToBottom) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

/**
 * Renderiza uma mensagem (Estilo WhatsApp)
 */
function renderMessage(message) {
  if (!message) return '';

  const hasRenderableContent = message.body
    || message.mediaUrl
    || message.hasMedia
    || isBase64ImageBody(message.body);

  if (!hasRenderableContent) {
    console.warn('⚠️ Mensagem inválida:', message);
    return '';
  }

  const isFromMe = message.fromMe === true || message.direction === 'outgoing';
  const messageClass = isFromMe ? 'outgoing' : 'incoming';
  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  const statusIcon = isFromMe ? renderStatusIcon(message) : '';
  const caption = getMessageCaption(message);
  const imageSrc = getImageSrc(message);
  const isImage = Boolean(imageSrc);
  const isAudio = ['audio', 'voice', 'ptt'].includes(message.type) && Boolean(message.mediaUrl);
  const isFile = Boolean(message.mediaUrl && !isImage && !isAudio);
  const hasCaption = Boolean(caption);

  if (isAudio) {
    const captionHtml = hasCaption
      ? `<div class="message-caption">${escapeHtml(caption)}</div>`
      : '';

    return `
      <div class="chat-message ${messageClass}" data-message-id="${message.id || message.messageId}">
        <div class="message-bubble has-media audio-message">
          <audio controls preload="metadata" class="message-audio">
            <source src="${escapeAttr(message.mediaUrl)}" type="audio/ogg">
            <source src="${escapeAttr(message.mediaUrl)}" type="audio/webm">
            <source src="${escapeAttr(message.mediaUrl)}" type="audio/mpeg">
          </audio>
          ${captionHtml}
          <div class="message-footer">
            <span class="message-time">${time}</span>
            ${statusIcon}
          </div>
        </div>
      </div>
    `;
  }

  if (isImage) {
    const overlayStatus = statusIcon
      ? statusIcon.replace('message-status', 'message-status message-status-overlay')
      : '';
    const captionHtml = hasCaption
      ? `<div class="message-caption">${escapeHtml(caption)}</div>`
      : '';

    return `
      <div class="chat-message ${messageClass}" data-message-id="${message.id || message.messageId}">
        <div class="message-bubble has-media image-message ${hasCaption ? 'has-caption' : 'media-only'}">
          <div class="message-media-wrap"
               data-media-url="${escapeAttr(imageSrc)}"
               data-media-type="image"
               data-media-name="${escapeAttr(message.mediaFilename || 'imagem.jpg')}"
               role="button"
               tabindex="0"
               title="Clique para ampliar">
            <img src="${escapeAttr(imageSrc)}" alt="Imagem" class="message-image" loading="lazy">
            <div class="message-media-overlay">
              <span class="message-time">${time}</span>
              ${overlayStatus}
            </div>
          </div>
          ${captionHtml}
          ${hasCaption ? `<div class="message-footer"><span class="message-time">${time}</span>${statusIcon}</div>` : ''}
        </div>
      </div>
    `;
  }

  if (isFile) {
    const fileName = message.mediaFilename || message.fileName || 'Arquivo';
    const fileMeta = getFileMetaLabel(message);
    const captionHtml = hasCaption
      ? `<div class="message-caption">${escapeHtml(caption)}</div>`
      : '';

    return `
      <div class="chat-message ${messageClass}" data-message-id="${message.id || message.messageId}">
        <div class="message-bubble has-media file-message">
          <div class="message-file-card"
               data-media-url="${escapeAttr(message.mediaUrl)}"
               data-media-type="file"
               data-media-name="${escapeAttr(fileName)}"
               role="button"
               tabindex="0"
               title="Clique para abrir ou baixar">
            <div class="message-file-icon">
              <i class="bi ${getFileIcon(message.type)}"></i>
            </div>
            <div class="message-file-info">
              <span class="message-file-name">${escapeHtml(fileName)}</span>
              <span class="message-file-meta">${escapeHtml(fileMeta)}</span>
            </div>
            <a href="${escapeAttr(message.mediaUrl)}"
               class="message-file-action"
               download="${escapeAttr(fileName)}"
               title="Baixar"
               onclick="event.stopPropagation()">
              <i class="bi bi-download"></i>
            </a>
          </div>
          ${captionHtml}
          <div class="message-footer">
            <span class="message-time">${time}</span>
            ${statusIcon}
          </div>
        </div>
      </div>
    `;
  }

  const content = renderTextContent(message);

  return `
    <div class="chat-message ${messageClass}" data-message-id="${message.id || message.messageId}">
      <div class="message-bubble">
        <div class="message-content">${content}</div>
        <div class="message-footer">
          <span class="message-time">${time}</span>
          ${statusIcon}
        </div>
      </div>
    </div>
  `;
}

function renderStatusIcon(message) {
  const isRead = message.status === 'read' || message.ack >= 3;
  const isDelivered = message.status === 'delivered' || message.ack === 2;
  const isSent = message.status === 'sent' || message.ack === 1;
  const isFailed = message.status === 'failed';
  const statusClass = isRead ? 'read' : '';

  if (isFailed) {
    return `<span class="message-status failed" title="Falha no envio"><i class="bi bi-exclamation-circle"></i></span>`;
  }
  if (isRead || isDelivered) {
    return `
      <span class="message-status ${statusClass}">
        <svg viewBox="0 0 18 18" width="16" height="16">
          <path fill="currentColor" d="M17.394 5.035l-.57-.444a.434.434 0 0 0-.609.076l-6.39 8.198a.38.38 0 0 1-.577.039l-.427-.388a.381.381 0 0 0-.578.038l-.451.576a.497.497 0 0 0 .043.645l1.575 1.51a.38.38 0 0 0 .577-.039l7.483-9.602a.436.436 0 0 0-.076-.609zm-4.892 0l-.57-.444a.434.434 0 0 0-.609.076l-6.39 8.198a.38.38 0 0 1-.577.039l-.427-.388a.381.381 0 0 0-.578.038l-.451.576a.497.497 0 0 0 .043.645l1.575 1.51a.38.38 0 0 0 .577-.039l7.483-9.602a.436.436 0 0 0-.076-.609z"/>
        </svg>
      </span>
    `;
  }
  if (isSent) {
    return `
      <span class="message-status">
        <svg viewBox="0 0 12 11" width="12" height="11">
          <path fill="currentColor" d="M11.1 2.4L9.8 1.2 4.3 6.7 2.1 4.5.9 5.7l3.4 3.4 6.8-6.7z"/>
        </svg>
      </span>
    `;
  }
  return `
    <span class="message-status">
      <svg viewBox="0 0 16 16" width="14" height="14">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
        <path fill="currentColor" d="M8 4v4.5l3 1.75"/>
      </svg>
    </span>
  `;
}

function renderTextContent(message) {
  if (isBase64Payload(message.body)) {
    return `<span class="message-media-label">${escapeHtml(getMediaLabel(message.type))}</span>`;
  }
  return escapeHtml(message.body || '');
}

function getImageSrc(message) {
  const type = message.type || 'text';
  const mediaUrl = message.mediaUrl || null;

  if (mediaUrl && (type === 'image' || isImageUrl(mediaUrl))) {
    return mediaUrl;
  }

  if (isBase64ImageBody(message.body)) {
    return message.body.startsWith('data:')
      ? message.body
      : `data:image/jpeg;base64,${message.body.trim()}`;
  }

  return null;
}

function getFileMetaLabel(message) {
  const type = message.type || 'document';
  const labels = {
    video: 'Vídeo',
    audio: 'Áudio',
    voice: 'Áudio',
    ptt: 'Áudio',
    document: 'Documento'
  };
  const typeLabel = labels[type] || 'Arquivo';
  if (message.mediaSize) return `${typeLabel} · ${formatFileSize(message.mediaSize)}`;
  return typeLabel;
}

function getFileIcon(type) {
  const icons = {
    video: 'bi-file-play',
    audio: 'bi-file-music',
    voice: 'bi-file-music',
    ptt: 'bi-file-music',
    document: 'bi-file-earmark-pdf'
  };
  return icons[type] || 'bi-file-earmark';
}

function handleMediaClick(event) {
  const wrap = event.target.closest('.message-media-wrap');
  if (wrap) {
    event.preventDefault();
    openMediaViewer(
      wrap.dataset.mediaUrl,
      wrap.dataset.mediaType || 'image',
      wrap.dataset.mediaName || 'imagem.jpg'
    );
    return;
  }

  const fileCard = event.target.closest('.message-file-card');
  if (fileCard) {
    openMediaViewer(
      fileCard.dataset.mediaUrl,
      'file',
      fileCard.dataset.mediaName || 'arquivo'
    );
  }
}

function mountMediaViewer() {
  const viewer = document.getElementById('mediaViewer');
  if (viewer && viewer.parentElement !== document.body) {
    document.body.appendChild(viewer);
  }
}

function optimizeViewerImageSize(img) {
  const apply = () => {
    img.style.width = '';
    img.style.height = '';

    const maxW = window.innerWidth * 0.92;
    const maxH = window.innerHeight * 0.86;
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;

    let scale = Math.min(maxW / naturalW, maxH / naturalH);

    const targetMinW = Math.min(maxW * 0.75, 640);
    if (naturalW * scale < targetMinW) {
      scale = Math.min(targetMinW / naturalW, maxH / naturalH);
    }

    img.style.width = `${Math.round(naturalW * scale)}px`;
    img.style.height = `${Math.round(naturalH * scale)}px`;
  };

  if (img.complete && img.naturalWidth) {
    apply();
  } else {
    img.onload = () => {
      apply();
      img.onload = null;
    };
  }
}

function openMediaViewer(url, type = 'image', fileName = 'arquivo') {
  if (!url) return;

  const viewer = document.getElementById('mediaViewer');
  const imageEl = document.getElementById('mediaViewerImage');
  const downloadEl = document.getElementById('mediaViewerDownload');
  const openEl = document.getElementById('mediaViewerOpen');
  const fileEl = document.getElementById('mediaViewerFile');
  const fileNameEl = document.getElementById('mediaViewerFileName');

  if (!viewer || !imageEl || !downloadEl) return;

  const isImage = type === 'image' || isImageUrl(url) || url.startsWith('data:image');

  if (isImage) {
    imageEl.style.display = 'block';
    imageEl.src = url;
    optimizeViewerImageSize(imageEl);
    if (fileEl) fileEl.style.display = 'none';
    if (openEl) {
      openEl.href = url;
      openEl.style.display = 'inline-flex';
    }
  } else {
    imageEl.style.display = 'none';
    imageEl.removeAttribute('src');
    if (fileEl) {
      fileEl.style.display = 'flex';
      if (fileNameEl) fileNameEl.textContent = fileName;
    }
    if (openEl) {
      openEl.href = url;
      openEl.style.display = 'inline-flex';
    }
  }

  downloadEl.href = url;
  downloadEl.setAttribute('download', fileName);
  viewer.style.display = 'flex';
  viewer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeMediaViewer() {
  const viewer = document.getElementById('mediaViewer');
  if (!viewer) return;
  viewer.style.display = 'none';
  viewer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  const imageEl = document.getElementById('mediaViewerImage');
  if (imageEl) {
    imageEl.removeAttribute('src');
    imageEl.style.width = '';
    imageEl.style.height = '';
  }
}

function handleMediaViewerBackdrop(event) {
  if (event.target.id === 'mediaViewer' || event.target.classList.contains('media-viewer-backdrop')) {
    closeMediaViewer();
  }
}

function getMessageCaption(message) {
  const body = message.body || '';
  if (!body || isBase64Payload(body)) return '';
  const label = getMediaLabel(message.type);
  if (body === label) return '';
  return body;
}

function formatMessagePreview(lastMessage) {
  if (!lastMessage) return 'Sem mensagens';
  let text = lastMessage.body || '';

  if (isBase64Payload(text) || lastMessage.hasMedia) {
    text = getMediaLabel(lastMessage.type) || '📎 Mídia';
  }

  if (lastMessage.direction === 'outgoing') {
    return `Você: ${text}`;
  }
  return text || 'Sem mensagens';
}

function getMediaLabel(type) {
  const labels = {
    image: '📷 Foto',
    video: '🎬 Vídeo',
    audio: '🎵 Áudio',
    voice: '🎵 Áudio',
    ptt: '🎵 Áudio',
    document: '📄 Arquivo',
    sticker: '🎨 Figurinha',
    location: '📍 Localização',
    contact: '👤 Contato'
  };
  return labels[type] || '📎 Mídia';
}

function isBase64Payload(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.startsWith('data:')) return true;
  if (trimmed.length < 120) return false;
  return /^\/9j\/|^iVBORw0KGgo|^R0lGOD|^JVBERi0|^UEsDB/.test(trimmed.substring(0, 16))
    || (trimmed.length > 300 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.substring(0, 256)));
}

function isBase64ImageBody(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return trimmed.startsWith('data:image/')
    || /^\/9j\//.test(trimmed)
    || /^iVBORw0KGgo/.test(trimmed);
}

function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url || '');
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Funções de status e reações removidas (design simplificado estilo WhatsApp)

/**
 * Envia mensagem
 */
async function sendMessage() {
  const textarea = document.getElementById('messageTextarea');
  const body = textarea.value.trim();
  
  if (!body && !selectedFile) {
    return;
  }
  
  if (!currentConversationId) {
    showToast('Selecione uma conversa', 'warning');
    return;
  }

  const sendBtn = document.getElementById('sendMessageBtn');
  if (sendBtn?.disabled) return;

  try {
    if (sendBtn) sendBtn.disabled = true;
    let mediaUrl = null;
    let mediaType = 'text';
    let fileName = null;
    let fileSize = null;
    
    // Upload de arquivo primeiro
    if (selectedFile) {
      const uploadResponse = await uploadFile(selectedFile);
      mediaUrl = uploadResponse.publicUrl
        || (uploadResponse.attachment?.storedFilename
          ? `/uploads/chat/${uploadResponse.attachment.storedFilename}`
          : null);
      mediaType = getMediaType(selectedFile.type);
      fileName = selectedFile.name;
      fileSize = selectedFile.size;
    }
    
    // Buscar ticket para pegar o número do destinatário
    const conversation = await apiFetch(`/conversations/${currentConversationId}`);
    const to = conversation.whatsappJid || conversation.userPhone || conversation.contact?.phone;
    
    const message = {
      conversationId: currentConversationId,
      ticketId: currentTicketId || null,
      to,
      body: body || (selectedFile ? getMediaLabel(mediaType) : ''),
      type: mediaType,
      mediaUrl: mediaUrl,
      fileName: fileName,
      fileSize: fileSize
    };
    
    console.log('📤 Enviando mensagem:', message);
    
    // Via API
    const response = await apiFetch('/chat/messages', {
      method: 'POST',
      body: message  // ✅ apiFetch já faz JSON.stringify!
    });
    
    console.log('✅ Resposta da API:', response);
    
    // Garantir campos de direção para alinhamento correto
    const sentMessage = {
      ...(response?.message || response),
      direction: 'outgoing',
      fromMe: true,
      status: response?.message?.status || response?.status || 'sent'
    };
    addMessageToChat(sentMessage);
    
    // Limpar input
    textarea.value = '';
    clearFileSelection();
    autoResizeTextarea(textarea);
    
    // Scroll para o final
    scrollToBottom();
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    showToast(error.message || 'Erro ao enviar mensagem', 'error');
  } finally {
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function toggleVoiceRecording() {
  const btn = document.getElementById('recordVoiceBtn');

  if (!isRecordingVoice) {
    if (!currentTicketId) {
      showToast('Selecione uma conversa', 'warning');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      voiceRecorder = new MediaRecorder(stream, { mimeType });
      voiceRecorder.ondataavailable = (event) => {
        if (event.data?.size) voiceChunks.push(event.data);
      };
      voiceRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        sendVoiceRecording(mimeType);
      };

      voiceRecorder.start();
      isRecordingVoice = true;
      btn?.classList.add('recording');
      btn?.setAttribute('title', 'Parar e enviar áudio');
    } catch {
      showToast('Permita o acesso ao microfone para gravar áudio', 'warning');
    }
    return;
  }

  voiceRecorder?.stop();
  isRecordingVoice = false;
  btn?.classList.remove('recording');
  btn?.setAttribute('title', 'Gravar mensagem de voz');
}

async function sendVoiceRecording(mimeType) {
  if (!voiceChunks.length || !currentTicketId) return;

  const btn = document.getElementById('recordVoiceBtn');
  const sendBtn = document.getElementById('sendMessageBtn');

  try {
    if (btn) btn.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    const blob = new Blob(voiceChunks, { type: mimeType.split(';')[0] });
    voiceChunks = [];

    if (blob.size < 1000) {
      showToast('Áudio muito curto. Grave novamente.', 'warning');
      return;
    }

    const extension = mimeType.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([blob], `voice_${Date.now()}.${extension}`, { type: blob.type });
    const uploadResponse = await uploadFile(file);
    const mediaUrl = uploadResponse.publicUrl
      || (uploadResponse.attachment?.storedFilename
        ? `/uploads/chat/${uploadResponse.attachment.storedFilename}`
        : null);

    const ticket = await apiFetch(`/tickets/${currentTicketId}`);
    const response = await apiFetch('/chat/messages', {
      method: 'POST',
      body: {
        ticketId: currentTicketId,
        to: ticket.userPhone,
        body: '🎵 Áudio',
        type: 'ptt',
        mediaUrl,
        fileName: file.name,
        fileSize: file.size
      }
    });

    const sentMessage = {
      ...(response?.message || response),
      direction: 'outgoing',
      fromMe: true,
      status: response?.message?.status || response?.status || 'sent'
    };
    addMessageToChat(sentMessage);
    scrollToBottom();
    refreshChatListSilently();
  } catch (error) {
    console.error('Erro ao enviar áudio:', error);
    showToast(error.message || 'Erro ao enviar mensagem de voz', 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    voiceRecorder = null;
  }
}

/**
 * Upload de arquivo
 */
async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ticketId', currentTicketId);
  
  const response = await fetch('/api/chat/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('Erro no upload');
  }

  const json = await response.json();
  return json.data || json;
}

/**
 * Manipula seleção de arquivo
 */
function handleFileSelect(file) {
  if (!file) return;
  
  selectedFile = file;
  
  // Preview
  document.getElementById('filePreviewName').textContent = file.name;
  document.getElementById('filePreviewSize').textContent = formatFileSize(file.size);
  document.getElementById('filePreview').style.display = 'block';
}

/**
 * Limpa seleção de arquivo
 */
function clearFileSelection() {
  selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('filePreview').style.display = 'none';
}

/**
 * Manipula nova mensagem recebida
 */
function handleNewMessage(data) {
  const message = data.message || data;
  const conversationId = data.conversationId || message.conversationId;
  const ticketId = data.ticketId || message.ticketId;
  const messageKey = message.id || message.messageId;
  const isIncoming = message.direction === 'incoming' || message.fromMe === false;
  const isCurrentChat = sameConversationId(conversationId, currentConversationId)
    || sameTicketId(ticketId, currentTicketId);
  const isOnChatPage = (location.hash || '').includes('chat');

  if (isCurrentChat && isOnChatPage) {
    if (!messageKey || !document.querySelector(`[data-message-id="${messageKey}"]`)) {
      addMessageToChat(message);
    }
    if (currentConversationId) {
      markMessagesAsRead(currentConversationId);
    }

    if (isIncoming && document.hidden) {
      const contactName = resolveContactDisplayName(data.conversation || data.contact || data);
      notifyNewMessage({ conversationId, message, contactName });
    }
  } else if (isIncoming) {
    const contactName = resolveContactDisplayName(data.conversation || data.contact || data);
    notifyNewMessage({ conversationId, message, contactName });
  }

  refreshChatListSilently();
  updateGlobalUnreadBadge();
}

function sameConversationId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function sameTicketId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function shouldNotifyMessage(messageKey) {
  if (!messageKey) return true;
  if (notifiedMessageIds.has(messageKey)) return false;
  notifiedMessageIds.add(messageKey);
  if (notifiedMessageIds.size > 300) {
    const oldest = notifiedMessageIds.values().next().value;
    notifiedMessageIds.delete(oldest);
  }
  return true;
}

function notifyNewMessage({ conversationId, message, contactName }) {
  const messageKey = message.id || message.messageId;
  if (!shouldNotifyMessage(messageKey)) return;

  const preview = formatMessagePreview(message);
  const sender = contactName || 'Contato';

  playNotificationSound();

  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Nova mensagem', {
      body: `${sender}: ${preview}`,
      icon: '/images/logotipo-astro.png',
      tag: `chat-${conversationId}`,
      renotify: true
    });

    notification.onclick = () => {
      window.focus();
      window.location.hash = '#chat';
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openChat', { detail: { conversationId } }));
      }, 300);
      notification.close();
    };
    return;
  }

  if (!document.hidden) {
    createToast({
      title: 'Nova mensagem',
      message: `${sender}: ${preview}`,
      variant: 'primary'
    });
  }
}

function playNotificationSound() {
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dtv24g');
    audio.volume = 0.35;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

async function updateGlobalUnreadBadge() {
  try {
    if (chatListStats.unread != null) {
      const badge = document.getElementById('chatBadge');
      if (badge) badge.textContent = chatListStats.unread > 99 ? '99+' : chatListStats.unread;
      return;
    }

    const response = await apiFetch('/conversations?limit=1&page=1');
    if (response?.stats) {
      chatListStats = response.stats;
      updateFilterCounts(chatListStats);
    }
  } catch {
    // ignore
  }
}

function updateMessageInChat(message) {
  const messageKey = message.id || message.messageId;
  if (!messageKey) return;

  const existing = document.querySelector(`[data-message-id="${messageKey}"]`);
  if (existing) {
    existing.outerHTML = renderMessage(message);
    return;
  }
  addMessageToChat(message);
}

/**
 * Adiciona mensagem ao chat
 */
function addMessageToChat(message) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  const messageKey = message.id || message.messageId;
  if (messageKey && document.querySelector(`[data-message-id="${messageKey}"]`)) {
    return;
  }
  
  if (messagesContainer.querySelector('.chat-system-message, .text-center')) {
    messagesContainer.innerHTML = '';
  }
  
  const messageHtml = renderMessage(message);
  if (messageHtml) {
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    enhanceChatImages();
    scrollToBottom();
  }
}

function enhanceChatImages() {
  document.querySelectorAll('#chatMessages .message-image').forEach((img) => {
    const apply = () => {
      const naturalW = img.naturalWidth;
      if (!naturalW) return;

      const maxW = 330;
      const minW = 220;

      if (naturalW < minW) {
        const scaled = Math.min(minW, maxW);
        img.style.width = `${scaled}px`;
        img.style.height = 'auto';
      } else if (naturalW > maxW) {
        img.style.width = `${maxW}px`;
        img.style.height = 'auto';
      } else {
        img.style.width = `${naturalW}px`;
        img.style.height = 'auto';
      }
    };

    if (img.complete && img.naturalWidth) {
      apply();
    } else {
      img.addEventListener('load', apply, { once: true });
    }
  });
}

/**
 * Manipula indicador de digitação
 */
function handleTyping() {
  if (!currentTicketId || !socket) return;
  
  // Emitir evento de digitação
  socket.emit('typing', { ticketId: currentTicketId });
  
  // Limpar timeout anterior
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  
  // Parar de digitar após 3 segundos
  typingTimeout = setTimeout(() => {
    socket.emit('stop_typing', { ticketId: currentTicketId });
  }, 3000);
}

/**
 * Mostra indicador de digitação
 */
function showTypingIndicator(data) {
  if (data.ticketId === currentTicketId) {
    document.getElementById('typingIndicator').style.display = 'flex';
    scrollToBottom();
  }
}

/**
 * Esconde indicador de digitação
 */
function hideTypingIndicator() {
  document.getElementById('typingIndicator').style.display = 'none';
}

/**
 * Marca mensagens como lidas
 */
async function markMessagesAsRead(conversationId) {
  try {
    await apiFetch('/chat/messages/read', {
      method: 'POST',
      body: { conversationId }
    });
    
    if (socket) {
      socket.emit('read_message', { conversationId });
    }
  } catch (error) {
    console.error('❌ Erro ao marcar como lido:', error);
  }
}

/**
 * Atualiza status da mensagem
 */
function updateMessageStatus(messageId, status) {
  const message = document.querySelector(`[data-message-id="${messageId}"]`);
  if (message) {
    const statusIcon = message.querySelector('.message-status');
    if (statusIcon) {
      statusIcon.className = `bi ${renderMessageStatus(status).match(/bi-[\w-]+/)[0]} message-status`;
    }
  }
}

/**
 * Manipula reação em mensagem
 */
function handleMessageReaction(data) {
  const message = document.querySelector(`[data-message-id="${data.messageId}"]`);
  if (message) {
    const reactionsContainer = message.querySelector('.message-reactions') || 
      document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    reactionsContainer.innerHTML = renderReactions(data.reactions);
    
    if (!message.querySelector('.message-reactions')) {
      message.querySelector('.message-content').appendChild(reactionsContainer);
    }
  }
}

/**
 * Auto-resize textarea
 */
function autoResizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

/**
 * Scroll para o final
 */
function scrollToBottom() {
  const messagesContainer = document.getElementById('chatMessages');
  if (messagesContainer) {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

/**
 * Abre/fecha menu de opções do chat
 */
function toggleChatMenu(forceOpen = null) {
  const menu = document.getElementById('chatHeaderDropdown');
  const toggle = document.getElementById('chatMenuToggle');
  if (!menu) return;

  const shouldOpen = forceOpen === null ? !menu.classList.contains('show') : forceOpen;
  menu.classList.toggle('show', shouldOpen);
  if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function closeChatMenu() {
  toggleChatMenu(false);
}

/**
 * Abre/fecha busca de mensagens na conversa
 */
function toggleMessageSearchBar(forceOpen = null) {
  const bar = document.getElementById('chatMessageSearchBar');
  const input = document.getElementById('chatMessageSearchInput');
  if (!bar) return;

  const isOpen = bar.style.display !== 'none';
  const shouldOpen = forceOpen === null ? !isOpen : forceOpen;

  bar.style.display = shouldOpen ? 'flex' : 'none';

  if (shouldOpen) {
    toggleInfoPanel(false);
    input?.focus();
    if (input?.value) searchMessagesInChat(input.value);
  } else {
    clearMessageSearch();
    if (input) input.value = '';
  }
}

function clearMessageSearch() {
  messageSearchMatches = [];
  messageSearchIndex = -1;
  document.querySelectorAll('#chatMessages .chat-message').forEach((el) => {
    el.classList.remove('search-match', 'search-current');
  });
  updateMessageSearchCount();
}

function searchMessagesInChat(query) {
  const q = String(query || '').trim().toLowerCase();
  const messages = document.querySelectorAll('#chatMessages .chat-message');
  messageSearchMatches = [];
  messageSearchIndex = -1;

  messages.forEach((el) => {
    el.classList.remove('search-match', 'search-current');
    if (!q) return;
    const text = el.textContent?.toLowerCase() || '';
    if (text.includes(q)) {
      messageSearchMatches.push(el);
      el.classList.add('search-match');
    }
  });

  updateMessageSearchCount();
  if (messageSearchMatches.length) {
    goToMessageSearchMatch(0);
  }
}

function goToMessageSearchMatch(index) {
  if (!messageSearchMatches.length) return;

  messageSearchMatches.forEach((el) => el.classList.remove('search-current'));
  messageSearchIndex = ((index % messageSearchMatches.length) + messageSearchMatches.length) % messageSearchMatches.length;

  const current = messageSearchMatches[messageSearchIndex];
  current.classList.add('search-current');
  current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  updateMessageSearchCount();
}

function updateMessageSearchCount() {
  const countEl = document.getElementById('chatMessageSearchCount');
  const prevBtn = document.getElementById('chatMessageSearchPrev');
  const nextBtn = document.getElementById('chatMessageSearchNext');
  const total = messageSearchMatches.length;
  const current = total ? messageSearchIndex + 1 : 0;

  if (countEl) countEl.textContent = `${current}/${total}`;
  if (prevBtn) prevBtn.disabled = total === 0;
  if (nextBtn) nextBtn.disabled = total === 0;
}

/**
 * Toggle painel de informações
 */
function toggleInfoPanel(forceOpen = null) {
  const panel = document.getElementById('chatInfoPanel');
  if (!panel) return;

  const isOpen = panel.style.display !== 'none';
  const shouldOpen = forceOpen === null ? !isOpen : forceOpen;

  panel.style.display = shouldOpen ? 'flex' : 'none';

  if (shouldOpen) {
    toggleMessageSearchBar(false);
    closeChatMenu();
  }
}

/**
 * Filtrar conversas por texto (servidor)
 */
function filterChats(searchText) {
  currentSearchText = searchText || '';
  chatListPage = 1;
  loadChats({ page: 1 });
}

/**
 * Filtrar conversas por status (servidor)
 */
function filterChatsByStatus(status) {
  currentChatFilter = status || 'all';
  chatListPage = 1;
  loadChats({ page: 1 });
}

/**
 * Atualizar contadores de filtros (totais globais)
 */
function updateFilterCounts(stats = chatListStats) {
  document.getElementById('filterAllCount').textContent = stats.all ?? 0;
  document.getElementById('filterUnreadCount').textContent = stats.unread ?? 0;
  document.getElementById('filterOpenCount').textContent = stats.open ?? 0;

  const badge = document.getElementById('chatBadge');
  if (badge) badge.textContent = (stats.unread ?? 0) > 99 ? '99+' : (stats.unread ?? 0);
}

/**
 * Atualizar badge de não lidas
 */
function updateChatItemUnread(ticketId) {
  const item = document.querySelector(`[data-ticket-id="${ticketId}"]`);
  if (item) {
    item.classList.add('unread');
    // TODO: Incrementar contador
  }
}

/**
 * Atualizar status do usuário
 */
function updateUserStatus(userId, status) {
  // TODO: Atualizar indicador de status online/offline
  console.log('Status do usuário:', userId, status);
}

/**
 * Finalizar atendimento da conversa atual
 */
async function finishCurrentChat() {
  if (!currentConversationId) {
    showToast('Selecione uma conversa', 'warning');
    return;
  }

  const hasActiveTicket = Boolean(currentTicketId || currentConversation?.activeTicket);
  if (!hasActiveTicket) {
    showToast('Nenhum atendimento ativo. Aceite a conversa antes de finalizar.', 'info');
    return;
  }

  await finishConversation(currentConversationId);
}

/**
 * Fechar ticket (legado)
 */
async function closeTicket() {
  await finishCurrentChat();
}

/**
 * Arquivar ticket
 */
async function archiveTicket() {
  if (!currentTicketId) {
    showToast('Aceite o atendimento para arquivar o ticket.', 'info');
    return;
  }

  if (!confirm('Deseja arquivar este ticket?')) return;
  
  try {
    await apiFetch(`/tickets/${currentTicketId}`, {
      method: 'PATCH',
      body: { archived: true }
    });
    
    showToast('Ticket arquivado com sucesso!', 'success');
    loadChats();
    
  } catch (error) {
    console.error('❌ Erro ao arquivar ticket:', error);
    showToast('Erro ao arquivar ticket', 'error');
  }
}

/**
 * Salvar contato da conversa atual
 */
async function saveContactFromChat() {
  if (!currentConversationId) return;

  try {
    showLoading();

    const response = await apiFetch(`/conversations/${currentConversationId}/save-contact`, {
      method: 'POST'
    });

    const conversation = response?.conversation;
    const alreadySaved = response?.alreadySaved;

    if (conversation) {
      currentConversation = conversation;
      renderChatHeader(conversation);

      const idx = cachedTickets.findIndex((item) => item.id === currentConversationId);
      if (idx >= 0) {
        cachedTickets[idx] = { ...cachedTickets[idx], ...conversation };
        renderChatList(cachedTickets);
        document.querySelector(`[data-conversation-id="${currentConversationId}"]`)?.classList.add('active');
      }
    }

    showToast(
      alreadySaved ? 'Este contato já está salvo na sua agenda.' : 'Contato salvo com sucesso!',
      alreadySaved ? 'info' : 'success'
    );
    hideLoading();
  } catch (error) {
    console.error('❌ Erro ao salvar contato:', error);
    showToast(error.message || 'Erro ao salvar contato', 'error');
    hideLoading();
  }
}

/**
 * Bloquear contato
 */
async function blockContact() {
  const contactId = currentConversation?.contact?.id;
  if (!contactId) {
    showToast('Contato não encontrado nesta conversa.', 'warning');
    return;
  }

  if (!confirm('Deseja bloquear este contato?')) return;

  try {
    await apiFetch(`/contacts/${contactId}/toggle-block`, { method: 'POST' });
    showToast('Contato bloqueado com sucesso!', 'success');
  } catch (error) {
    console.error('❌ Erro ao bloquear contato:', error);
    showToast(error.message || 'Erro ao bloquear contato', 'error');
  }
}

/**
 * Mostra notificação de novo ticket
 */
function showConversationNotification(data) {
  const conversation = data.conversation || {};
  const conversationId = conversation.id;
  const notification = document.createElement('div');
  notification.className = 'alert alert-info alert-dismissible fade show position-fixed top-0 end-0 m-3';
  notification.style.zIndex = '9999';
  notification.style.minWidth = '300px';
  notification.innerHTML = `
    <h6><i class="bi bi-bell-fill"></i> Cliente Aguardando Atendimento!</h6>
    <p class="mb-2"><strong>${escapeHtml(resolveContactDisplayName(conversation))}</strong></p>
    <p class="mb-3 small">${data.message || 'Nova solicitação de atendimento'}</p>
    <div class="d-grid gap-2">
      <button class="btn btn-success btn-sm" onclick="acceptTicketFromNotification('${conversationId}')">
        <i class="bi bi-check-circle"></i> Aceitar Atendimento
      </button>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(notification);
  
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dtv24g');
    audio.play().catch(() => {});
  } catch (e) {}
  
  setTimeout(() => {
    notification.remove();
  }, 30000);
}

async function acceptConversationFromNotification(conversationId) {
  await acceptConversation(conversationId);
  await openChat(conversationId);
}

async function acceptConversation(conversationId) {
  try {
    showLoading();
    
    const response = await apiFetch(`/conversations/${conversationId}/accept`, {
      method: 'POST'
    });
    
    const ticket = response?.ticket || response?.data?.ticket;
    if (ticket?.id) currentTicketId = ticket.id;
    
    showToast('✅ Atendimento aceito! Você está atendendo este cliente.', 'success');
    
    if (currentConversationId === conversationId) {
      const conversation = await apiFetch(`/conversations/${conversationId}`);
      currentConversation = conversation;
      renderChatHeader(conversation);
      if (socket && currentTicketId) {
        socket.emit('join_ticket', currentTicketId);
      }
    }
    
    await loadChats();
    hideLoading();
  } catch (error) {
    console.error('❌ Erro ao aceitar atendimento:', error);
    showToast('Erro ao aceitar atendimento', 'error');
    hideLoading();
  }
}

async function finishConversation(conversationId) {
  try {
    const feedback = prompt('Deseja adicionar um comentário sobre este atendimento? (Opcional)');
    
    showLoading();
    
    await apiFetch(`/conversations/${conversationId}/finish`, {
      method: 'POST',
      body: { feedback: feedback || null }
    });
    
    showToast('✅ Atendimento finalizado com sucesso!', 'success');
    
    await loadChats();
    
    currentTicketId = null;
    if (currentConversationId === conversationId) {
      const conversation = await apiFetch(`/conversations/${conversationId}`);
      currentConversation = conversation;
      renderChatHeader(conversation);
    }
    
    hideLoading();
  } catch (error) {
    console.error('❌ Erro ao finalizar atendimento:', error);
    showToast('Erro ao finalizar atendimento', 'error');
    hideLoading();
  }
}

/**
 * Helpers
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Ontem';
  }

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function getMediaType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function getStatusLabel(status) {
  const labels = {
    open: 'Aberto',
    pending: 'Pendente',
    waiting: 'Aguardando',
    waiting_human: 'Aguardando Humano',
    in_progress: 'Em Atendimento',
    closed: 'Fechado',
    resolved: 'Resolvido'
  };
  return labels[status] || status;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Cleanup ao sair da view
 */
export function cleanupChatView() {
  if (isRecordingVoice && voiceRecorder) {
    voiceRecorder.stop();
    voiceRecorder.stream?.getTracks().forEach((track) => track.stop());
    isRecordingVoice = false;
    voiceRecorder = null;
    voiceChunks = [];
    document.getElementById('recordVoiceBtn')?.classList.remove('recording');
  }

  if (socket && currentConversationId) {
    socket.emit('leave_conversation', currentConversationId);
  }
  if (socket && currentTicketId) {
    socket.emit('leave_ticket', currentTicketId);
  }

  if (chatPollInterval) {
    clearInterval(chatPollInterval);
    chatPollInterval = null;
  }

  currentConversationId = null;
  currentTicketId = null;
}

