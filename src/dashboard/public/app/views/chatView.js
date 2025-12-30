/**
 * CHAT VIEW - Interface de Chat em Tempo Real
 * Socket.IO + Mensagens + Upload de Arquivos
 */

import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';

// Socket.IO
let socket = null;
let currentTicketId = null;
let currentUserId = null;
let typingTimeout = null;
let selectedFile = null;

/**
 * Inicializa a view do chat
 */
export async function initChatView() {
  console.log('🎨 Inicializando Chat View...');
  
  // Conectar Socket.IO
  connectSocket();
  
  // Carregar conversas
  await loadChats();
  
  // Event Listeners
  setupEventListeners();
  
  console.log('✅ Chat View inicializado');
}

/**
 * Conecta ao Socket.IO
 */
function connectSocket() {
  // Obter URL do servidor
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const socketUrl = `${protocol}//${host}`;
  
  console.log('🔌 Conectando ao Socket.IO:', socketUrl);
  
  // Conectar
  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });
  
  // Eventos de conexão
  socket.on('connect', () => {
    console.log('✅ Socket.IO conectado:', socket.id);
    authenticateSocket();
  });
  
  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.IO desconectado:', reason);
    showToast('Conexão perdida. Tentando reconectar...', 'warning');
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket.IO reconectado após', attemptNumber, 'tentativas');
    showToast('Conexão reestabelecida!', 'success');
    authenticateSocket();
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Erro de conexão Socket.IO:', error);
  });
  
  // Eventos do chat
  setupSocketEvents();
}

/**
 * Autentica o usuário no Socket.IO
 */
function authenticateSocket() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  currentUserId = user.id;
  
  socket.emit('authenticate', {
    token: token,
    userId: user.id,
    name: user.name,
    role: user.role
  });
}

/**
 * Configura eventos do Socket.IO
 */
function setupSocketEvents() {
  // Autenticação
  socket.on('authenticated', (data) => {
    console.log('✅ Autenticado no chat:', data);
  });
  
  // Nova mensagem
  socket.on('new_message', (data) => {
    console.log('📨 Nova mensagem recebida:', data);
    handleNewMessage(data);
  });
  
  // Mensagem enviada
  socket.on('message_sent', (data) => {
    console.log('✅ Mensagem enviada:', data);
  });
  
  // Mensagem lida
  socket.on('message_read', (data) => {
    console.log('👁️ Mensagem lida:', data);
    updateMessageStatus(data.messageId, 'read');
  });
  
  // Reação em mensagem
  socket.on('message_reaction', (data) => {
    console.log('❤️ Reação adicionada:', data);
    handleMessageReaction(data);
  });
  
  // Usuário digitando
  socket.on('user_typing', (data) => {
    console.log('⌨️ Usuário digitando:', data);
    showTypingIndicator(data);
  });
  
  socket.on('user_stop_typing', (data) => {
    console.log('🛑 Usuário parou de digitar:', data);
    hideTypingIndicator();
  });
  
  // Status de usuários
  socket.on('user_online', (data) => {
    console.log('🟢 Usuário online:', data);
    updateUserStatus(data.userId, 'online');
  });
  
  socket.on('user_offline', (data) => {
    console.log('⚫ Usuário offline:', data);
    updateUserStatus(data.userId, 'offline');
  });
  
  // Ticket join/leave
  socket.on('joined_ticket', (data) => {
    console.log('✅ Entrou no ticket:', data);
  });
  
  socket.on('user_joined_ticket', (data) => {
    console.log('👤 Outro usuário entrou:', data);
  });
  
  socket.on('user_left_ticket', (data) => {
    console.log('👋 Usuário saiu:', data);
  });
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
  // Busca de conversas
  const searchInput = document.getElementById('chatSearchInput');
  searchInput?.addEventListener('input', (e) => {
    filterChats(e.target.value);
  });
  
  // Filtros
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      filterChatsByStatus(e.target.dataset.filter);
    });
  });
  
  // Refresh
  document.getElementById('refreshChatsBtn')?.addEventListener('click', loadChats);
  
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
  
  // Painel de informações
  document.getElementById('chatInfoToggle')?.addEventListener('click', toggleInfoPanel);
  document.getElementById('closeInfoPanel')?.addEventListener('click', toggleInfoPanel);
  
  // Ações de ticket
  document.getElementById('chatCloseBtn')?.addEventListener('click', closeTicket);
  document.getElementById('chatArchiveBtn')?.addEventListener('click', archiveTicket);
  document.getElementById('chatBlockBtn')?.addEventListener('click', blockContact);
}

/**
 * Carrega lista de conversas
 */
async function loadChats() {
  try {
    showLoading();
    
    const response = await apiFetch('/tickets', {
      params: {
        status: 'open,pending,waiting',
        limit: 100
      }
    });
    
    const tickets = response.data || [];
    renderChatList(tickets);
    
    // Atualizar contadores
    updateFilterCounts(tickets);
    
  } catch (error) {
    console.error('❌ Erro ao carregar conversas:', error);
    showToast('Erro ao carregar conversas', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Renderiza lista de conversas
 */
function renderChatList(tickets) {
  const chatList = document.getElementById('chatList');
  
  if (!tickets || tickets.length === 0) {
    chatList.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-chat-dots fs-1"></i>
        <p class="mt-2">Nenhuma conversa ativa</p>
      </div>
    `;
    return;
  }
  
  chatList.innerHTML = tickets.map(ticket => {
    const contact = ticket.contact || {};
    const lastMessage = ticket.lastMessage || {};
    const unreadCount = ticket.unreadMessages || 0;
    
    return `
      <div class="chat-item ${unreadCount > 0 ? 'unread' : ''}" data-ticket-id="${ticket.id}">
        <div class="chat-item-avatar">
          <span>${getInitials(contact.name)}</span>
          ${ticket.status === 'open' ? '<span class="status-indicator online"></span>' : ''}
        </div>
        <div class="chat-item-content">
          <div class="chat-item-header">
            <h6 class="chat-item-name">${contact.name || 'Sem nome'}</h6>
            <span class="chat-item-time">${formatTime(lastMessage.timestamp || ticket.updatedAt)}</span>
          </div>
          <div class="chat-item-message">
            <p class="mb-0">${lastMessage.body || 'Sem mensagens'}</p>
            ${unreadCount > 0 ? `<span class="badge bg-danger rounded-pill">${unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Event listeners para cada item
  document.querySelectorAll('.chat-item').forEach(item => {
    item.addEventListener('click', () => {
      const ticketId = item.dataset.ticketId;
      openChat(ticketId);
    });
  });
}

/**
 * Abre um chat
 */
async function openChat(ticketId) {
  try {
    showLoading();
    
    // Deixar ticket anterior
    if (currentTicketId && socket) {
      socket.emit('leave_ticket', currentTicketId);
    }
    
    currentTicketId = ticketId;
    
    // Carregar mensagens
    const response = await apiFetch(`/api/chat/tickets/${ticketId}/messages`);
    const messages = response.data || [];
    
    // Carregar dados do ticket
    const ticketResponse = await apiFetch(`/api/tickets/${ticketId}`);
    const ticket = ticketResponse.data;
    
    // Renderizar chat
    renderChatHeader(ticket);
    renderMessages(messages);
    
    // Mostrar elementos do chat
    document.getElementById('chatEmptyState').style.display = 'none';
    document.getElementById('chatHeader').style.display = 'flex';
    document.getElementById('chatMessages').style.display = 'block';
    document.getElementById('chatInput').style.display = 'block';
    
    // Marcar item como ativo
    document.querySelectorAll('.chat-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-ticket-id="${ticketId}"]`)?.classList.add('active');
    
    // Entrar no ticket via Socket.IO
    if (socket) {
      socket.emit('join_ticket', ticketId);
    }
    
    // Marcar mensagens como lidas
    markMessagesAsRead(ticketId);
    
    // Scroll para o final
    scrollToBottom();
    
  } catch (error) {
    console.error('❌ Erro ao abrir chat:', error);
    showToast('Erro ao abrir conversa', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Renderiza cabeçalho do chat
 */
function renderChatHeader(ticket) {
  const contact = ticket.contact || {};
  const queue = ticket.queue || {};
  const agent = ticket.user || {};
  
  document.getElementById('chatContactInitials').textContent = getInitials(contact.name);
  document.getElementById('chatContactName').textContent = contact.name || 'Sem nome';
  document.getElementById('chatContactInfo').textContent = contact.number || '';
  
  // Status indicator
  const statusIndicator = document.getElementById('chatContactStatus');
  statusIndicator.className = `status-indicator ${ticket.status === 'open' ? 'online' : 'offline'}`;
  
  // Painel de informações
  document.getElementById('infoContactName').textContent = contact.name || '-';
  document.getElementById('infoContactPhone').textContent = contact.number || '-';
  document.getElementById('infoTicketStatus').textContent = getStatusLabel(ticket.status);
  document.getElementById('infoTicketQueue').textContent = queue.name || '-';
  document.getElementById('infoTicketAgent').textContent = agent.name || 'Não atribuído';
  
  // Tags
  if (ticket.tags && ticket.tags.length > 0) {
    document.getElementById('infoTicketTags').innerHTML = ticket.tags.map(tag => 
      `<span class="badge" style="background-color: ${tag.color}">${tag.name}</span>`
    ).join(' ');
  }
}

/**
 * Renderiza mensagens
 */
function renderMessages(messages) {
  const messagesContainer = document.getElementById('chatMessages');
  
  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="bi bi-chat-square-text fs-1"></i>
        <p class="mt-2">Nenhuma mensagem ainda</p>
      </div>
    `;
    return;
  }
  
  messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
  
  // Event listeners para reações
  messagesContainer.querySelectorAll('.message-react-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const messageId = e.target.closest('.message').dataset.messageId;
      showReactionPicker(messageId);
    });
  });
}

/**
 * Renderiza uma mensagem
 */
function renderMessage(message) {
  const isFromMe = message.fromMe || message.senderId === currentUserId;
  const messageClass = isFromMe ? 'message-outgoing' : 'message-incoming';
  
  let content = '';
  
  // Texto
  if (message.type === 'text' || !message.type) {
    content = `<div class="message-text">${escapeHtml(message.body)}</div>`;
  }
  
  // Imagem
  if (message.type === 'image') {
    content = `
      <div class="message-media">
        <img src="${message.mediaUrl}" alt="Imagem" class="message-image">
        ${message.body ? `<div class="message-text mt-2">${escapeHtml(message.body)}</div>` : ''}
      </div>
    `;
  }
  
  // Vídeo
  if (message.type === 'video') {
    content = `
      <div class="message-media">
        <video controls class="message-video">
          <source src="${message.mediaUrl}" type="video/mp4">
        </video>
        ${message.body ? `<div class="message-text mt-2">${escapeHtml(message.body)}</div>` : ''}
      </div>
    `;
  }
  
  // Áudio
  if (message.type === 'audio' || message.type === 'voice' || message.type === 'ptt') {
    content = `
      <div class="message-media">
        <audio controls class="message-audio">
          <source src="${message.mediaUrl}" type="audio/mpeg">
        </audio>
      </div>
    `;
  }
  
  // Documento
  if (message.type === 'document') {
    content = `
      <div class="message-document">
        <i class="bi bi-file-earmark-text fs-3"></i>
        <div>
          <div class="fw-bold">${message.fileName || 'Documento'}</div>
          <small class="text-muted">${formatFileSize(message.fileSize)}</small>
        </div>
        <a href="${message.mediaUrl}" download class="btn btn-sm btn-outline-primary">
          <i class="bi bi-download"></i>
        </a>
      </div>
    `;
  }
  
  return `
    <div class="message ${messageClass}" data-message-id="${message.id}">
      <div class="message-content">
        ${content}
        <div class="message-footer">
          <span class="message-time">${formatTime(message.timestamp)}</span>
          ${isFromMe ? renderMessageStatus(message.status) : ''}
        </div>
      </div>
      ${message.reactions ? renderReactions(message.reactions) : ''}
      <button class="message-react-btn" title="Reagir">
        <i class="bi bi-emoji-smile"></i>
      </button>
    </div>
  `;
}

/**
 * Renderiza status da mensagem
 */
function renderMessageStatus(status) {
  const icons = {
    pending: 'bi-clock',
    sent: 'bi-check',
    delivered: 'bi-check-all',
    read: 'bi-check-all text-primary',
    failed: 'bi-x-circle text-danger'
  };
  
  return `<i class="bi ${icons[status] || icons.pending} message-status"></i>`;
}

/**
 * Renderiza reações
 */
function renderReactions(reactions) {
  if (!reactions || Object.keys(reactions).length === 0) return '';
  
  return `
    <div class="message-reactions">
      ${Object.entries(reactions).map(([emoji, count]) => 
        `<span class="reaction-item">${emoji} ${count}</span>`
      ).join('')}
    </div>
  `;
}

/**
 * Envia mensagem
 */
async function sendMessage() {
  const textarea = document.getElementById('messageTextarea');
  const body = textarea.value.trim();
  
  if (!body && !selectedFile) {
    return;
  }
  
  if (!currentTicketId) {
    showToast('Selecione uma conversa', 'warning');
    return;
  }
  
  try {
    let mediaUrl = null;
    let mediaType = 'text';
    let fileName = null;
    let fileSize = null;
    
    // Upload de arquivo primeiro
    if (selectedFile) {
      const uploadResponse = await uploadFile(selectedFile);
      mediaUrl = uploadResponse.publicUrl;
      mediaType = getMediaType(selectedFile.type);
      fileName = selectedFile.name;
      fileSize = selectedFile.size;
    }
    
    // Enviar mensagem
    const message = {
      ticketId: currentTicketId,
      body: body,
      type: mediaType,
      mediaUrl: mediaUrl,
      fileName: fileName,
      fileSize: fileSize
    };
    
    // Via Socket.IO para tempo real
    if (socket) {
      socket.emit('send_message', message);
    }
    
    // Também via API para garantir
    await apiFetch('/chat/messages', {
      method: 'POST',
      body: JSON.stringify(message)
    });
    
    // Limpar input
    textarea.value = '';
    clearFileSelection();
    autoResizeTextarea(textarea);
    
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    showToast('Erro ao enviar mensagem', 'error');
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
  
  return await response.json();
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
  if (data.ticketId === currentTicketId) {
    // Adicionar mensagem ao chat
    const messagesContainer = document.getElementById('chatMessages');
    const messageHtml = renderMessage(data.message);
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    scrollToBottom();
    
    // Marcar como lida
    markMessagesAsRead(currentTicketId);
  } else {
    // Atualizar badge
    updateChatItemUnread(data.ticketId);
  }
  
  // Atualizar lista de conversas
  loadChats();
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
async function markMessagesAsRead(ticketId) {
  try {
    await apiFetch('/chat/messages/read', {
      method: 'POST',
      body: JSON.stringify({ ticketId })
    });
    
    if (socket) {
      socket.emit('read_message', { ticketId });
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
 * Toggle painel de informações
 */
function toggleInfoPanel() {
  const panel = document.getElementById('chatInfoPanel');
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

/**
 * Filtrar conversas por texto
 */
function filterChats(searchText) {
  const items = document.querySelectorAll('.chat-item');
  const search = searchText.toLowerCase();
  
  items.forEach(item => {
    const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
    const message = item.querySelector('.chat-item-message p').textContent.toLowerCase();
    
    if (name.includes(search) || message.includes(search)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * Filtrar conversas por status
 */
function filterChatsByStatus(status) {
  // TODO: Implementar filtro por status
  console.log('Filtrar por status:', status);
}

/**
 * Atualizar contadores de filtros
 */
function updateFilterCounts(tickets) {
  document.getElementById('filterAllCount').textContent = tickets.length;
  
  const unread = tickets.filter(t => (t.unreadMessages || 0) > 0).length;
  document.getElementById('filterUnreadCount').textContent = unread;
  
  const open = tickets.filter(t => t.status === 'open').length;
  document.getElementById('filterOpenCount').textContent = open;
  
  // Atualizar badge do menu
  document.getElementById('chatBadge').textContent = unread;
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
 * Fechar ticket
 */
async function closeTicket() {
  if (!currentTicketId) return;
  
  if (!confirm('Deseja finalizar este ticket?')) return;
  
  try {
    await apiFetch(`/api/tickets/${currentTicketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'closed' })
    });
    
    showToast('Ticket finalizado com sucesso!', 'success');
    loadChats();
    
    // Fechar chat
    document.getElementById('chatEmptyState').style.display = 'flex';
    document.getElementById('chatHeader').style.display = 'none';
    document.getElementById('chatMessages').style.display = 'none';
    document.getElementById('chatInput').style.display = 'none';
    currentTicketId = null;
    
  } catch (error) {
    console.error('❌ Erro ao fechar ticket:', error);
    showToast('Erro ao finalizar ticket', 'error');
  }
}

/**
 * Arquivar ticket
 */
async function archiveTicket() {
  if (!currentTicketId) return;
  
  if (!confirm('Deseja arquivar este ticket?')) return;
  
  try {
    await apiFetch(`/api/tickets/${currentTicketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ archived: true })
    });
    
    showToast('Ticket arquivado com sucesso!', 'success');
    loadChats();
    
  } catch (error) {
    console.error('❌ Erro ao arquivar ticket:', error);
    showToast('Erro ao arquivar ticket', 'error');
  }
}

/**
 * Bloquear contato
 */
async function blockContact() {
  if (!currentTicketId) return;
  
  if (!confirm('Deseja bloquear este contato? Esta ação não pode ser desfeita.')) return;
  
  try {
    // TODO: Implementar bloqueio de contato
    showToast('Contato bloqueado com sucesso!', 'success');
    
  } catch (error) {
    console.error('❌ Erro ao bloquear contato:', error);
    showToast('Erro ao bloquear contato', 'error');
  }
}

/**
 * Helpers
 */
function getInitials(name) {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  if (socket) {
    if (currentTicketId) {
      socket.emit('leave_ticket', currentTicketId);
    }
    socket.disconnect();
    socket = null;
  }
  
  currentTicketId = null;
  currentUserId = null;
}

