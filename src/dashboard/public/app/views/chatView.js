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
  // Obter URL do servidor (mesma lógica do api.js)
  let serverUrl = window.location.origin;
  
  // Tentar ler de meta tag (configurado para produção)
  const apiUrlMeta = document.querySelector('meta[name="api-url"]');
  if (apiUrlMeta) {
    const url = apiUrlMeta.getAttribute('content');
    if (url && url.trim()) {
      // Remover /api do final se existir
      serverUrl = url.replace(/\/api\/?$/, '');
    }
  }
  
  // Tentar ler de script tag
  const apiConfigScript = document.getElementById('api-config');
  if (apiConfigScript && apiConfigScript.textContent) {
    try {
      const config = JSON.parse(apiConfigScript.textContent);
      if (config.apiUrl) {
        serverUrl = config.apiUrl.replace(/\/api\/?$/, '');
      }
    } catch (e) {
      // Ignorar erro
    }
  }
  
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const socketUrl = serverUrl.startsWith('http') ? serverUrl : `${protocol}//${serverUrl}`;
  
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
  
  // 🔔 NOVOS EVENTOS: Notificações de Tickets
  socket.on('new_ticket_notification', (data) => {
    console.log('🔔 Novo ticket aguardando atendente:', data);
    showTicketNotification(data);
    // Recarregar lista de chats para mostrar novo ticket
    loadChats();
  });
  
  socket.on('ticket_accepted', (data) => {
    console.log('✅ Ticket aceito:', data);
    showToast(`Ticket ${data.protocol} aceito por ${data.agentName}`, 'success');
    loadChats();
  });
  
  socket.on('ticket_rejected', (data) => {
    console.log('⏭️ Ticket rejeitado:', data);
    loadChats();
  });
  
  socket.on('ticket_finished', (data) => {
    console.log('🏁 Ticket finalizado:', data);
    showToast(`Ticket ${data.protocol} finalizado`, 'info');
    loadChats();
  });
  
  socket.on('ticket_auto_assigned', (data) => {
    console.log('🤖 Ticket atribuído automaticamente à IA:', data);
    loadChats();
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

  // Evento global para abrir chat de um ticket específico
  window.addEventListener('openChat', (event) => {
    const ticketId = event?.detail?.ticketId;
    if (ticketId) {
      console.log('🎯 Abrindo chat do ticket:', ticketId);
      openChat(ticketId);
    }
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
    
    // Não passar status específicos - deixar o backend filtrar automaticamente
    // Para agents: mostra apenas tickets atribuídos (assignedTo = userId)
    // Para admins/managers: mostra todos os tickets ativos
    const tickets = await apiFetch('/tickets?limit=100');
    
    console.log('📋 Tickets carregados para chat:', tickets);
    
    const ticketsArray = Array.isArray(tickets) ? tickets : [];
    
    // Filtrar apenas tickets relevantes para chat (ativos)
    const activeTickets = ticketsArray.filter(t => 
      ['open', 'in_progress', 'waiting_human'].includes(t.status)
    );
    
    console.log('📋 Tickets ativos filtrados:', activeTickets.length);
    
    renderChatList(activeTickets);
    
    // Atualizar contadores
    updateFilterCounts(activeTickets);
    
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
    const messagesResponse = await apiFetch(`/chat/tickets/${ticketId}/messages`);
    const messages = messagesResponse?.messages || messagesResponse?.data?.messages || [];
    
    console.log('📨 Mensagens recebidas:', messages.length, messages);
    
    // Carregar dados do ticket
    const ticket = await apiFetch(`/tickets/${ticketId}`);
    
    console.log('📋 Ticket carregado:', ticket);
    
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
  // Usar dados diretos do ticket (sem relações)
  const contactName = ticket.userName || ticket.contact?.name || 'Sem nome';
  const contactPhone = ticket.userPhone || ticket.contact?.number || '';
  const queueName = ticket.department || ticket.queue?.name || '-';
  const agentName = ticket.assignedAgent?.name || 'Não atribuído';
  
  const initialsEl = document.getElementById('chatContactInitials');
  if (initialsEl) initialsEl.textContent = getInitials(contactName);
  
  const nameEl = document.getElementById('chatContactName');
  if (nameEl) nameEl.textContent = contactName;
  
  const infoEl = document.getElementById('chatContactInfo');
  if (infoEl) infoEl.textContent = contactPhone;
  
  // Status indicator
  const statusIndicator = document.getElementById('chatContactStatus');
  if (statusIndicator) {
    statusIndicator.className = `status-indicator ${ticket.status === 'open' || ticket.status === 'in_progress' ? 'online' : 'offline'}`;
  }
  
  // Painel de informações
  const infoNameEl = document.getElementById('infoContactName');
  if (infoNameEl) infoNameEl.textContent = contactName;
  
  const infoPhoneEl = document.getElementById('infoContactPhone');
  if (infoPhoneEl) infoPhoneEl.textContent = contactPhone;
  
  const infoStatusEl = document.getElementById('infoTicketStatus');
  if (infoStatusEl) infoStatusEl.textContent = getStatusLabel(ticket.status);
  
  const infoQueueEl = document.getElementById('infoTicketQueue');
  if (infoQueueEl) infoQueueEl.textContent = queueName;
  
  const infoAgentEl = document.getElementById('infoTicketAgent');
  if (infoAgentEl) infoAgentEl.textContent = agentName;
  
  // Tags (se existirem)
  const infoTagsEl = document.getElementById('infoTicketTags');
  if (infoTagsEl && ticket.tags && ticket.tags.length > 0) {
    infoTagsEl.innerHTML = ticket.tags.map(tag => 
      `<span class="badge" style="background-color: ${tag.color}">${tag.name}</span>`
    ).join(' ');
  }
  
  // Renderizar botões de ação (aceitar, rejeitar, finalizar)
  renderActionButtons(ticket);
}

/**
 * Renderiza botões de ação no cabeçalho (Aceitar, Rejeitar, Finalizar)
 */
function renderActionButtons(ticket) {
  const actionsContainer = document.getElementById('chatHeaderActions');
  if (!actionsContainer) return;
  
  // Limpar botões existentes
  actionsContainer.innerHTML = '';
  
  // Obter usuário logado
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Se ticket está aguardando atendente (waiting_human)
  if (ticket.status === 'waiting_human') {
    actionsContainer.innerHTML = `
      <button class="btn btn-success btn-sm" onclick="acceptTicket(${ticket.id})" title="Aceitar Atendimento">
        <i class="bi bi-check-circle"></i> Aceitar
      </button>
      <button class="btn btn-secondary btn-sm" onclick="rejectTicket(${ticket.id})" title="Rejeitar (IA assume)">
        <i class="bi bi-x-circle"></i> Rejeitar
      </button>
    `;
  }
  
  // Se ticket está em progresso E atribuído ao atendente logado
  if (ticket.status === 'in_progress' && ticket.assignedTo === currentUser.id) {
    actionsContainer.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="finishTicket(${ticket.id})" title="Finalizar Atendimento">
        <i class="bi bi-check2-all"></i> Finalizar Atendimento
      </button>
    `;
  }
}

/**
 * Renderiza mensagens (Estilo WhatsApp)
 */
function renderMessages(messages) {
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
  
  messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
  
  // Scroll automático para o final
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Renderiza uma mensagem (Estilo WhatsApp)
 */
function renderMessage(message) {
  // Verificar se mensagem é válida
  if (!message || !message.body) {
    console.warn('⚠️ Mensagem inválida:', message);
    return '';
  }
  
  const isFromMe = message.fromMe || message.direction === 'outgoing' || message.userId === currentUserId;
  const messageClass = isFromMe ? 'outgoing' : 'incoming';
  
  // Conteúdo da mensagem
  let content = escapeHtml(message.body);
  
  // Formatar hora
  const time = message.timestamp ? new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  
  // Status de leitura (apenas para mensagens enviadas)
  let statusIcon = '';
  if (isFromMe) {
    const isRead = message.status === 'read' || message.ack >= 3;
    const isDelivered = message.status === 'delivered' || message.ack === 2;
    const isSent = message.status === 'sent' || message.ack === 1;
    
    const statusClass = isRead ? 'read' : '';
    
    if (isRead || isDelivered) {
      // Check duplo
      statusIcon = `
        <span class="message-status ${statusClass}">
          <svg viewBox="0 0 18 18" width="18" height="18">
            <path fill="currentColor" d="M17.394 5.035l-.57-.444a.434.434 0 0 0-.609.076l-6.39 8.198a.38.38 0 0 1-.577.039l-.427-.388a.381.381 0 0 0-.578.038l-.451.576a.497.497 0 0 0 .043.645l1.575 1.51a.38.38 0 0 0 .577-.039l7.483-9.602a.436.436 0 0 0-.076-.609zm-4.892 0l-.57-.444a.434.434 0 0 0-.609.076l-6.39 8.198a.38.38 0 0 1-.577.039l-.427-.388a.381.381 0 0 0-.578.038l-.451.576a.497.497 0 0 0 .043.645l1.575 1.51a.38.38 0 0 0 .577-.039l7.483-9.602a.436.436 0 0 0-.076-.609z"/>
          </svg>
        </span>
      `;
    } else if (isSent) {
      // Check simples
      statusIcon = `
        <span class="message-status">
          <svg viewBox="0 0 12 11" width="12" height="11">
            <path fill="currentColor" d="M11.1 2.4L9.8 1.2 4.3 6.7 2.1 4.5.9 5.7l3.4 3.4 6.8-6.7z"/>
          </svg>
        </span>
      `;
    } else {
      // Relógio (pendente)
      statusIcon = `
        <span class="message-status">
          <svg viewBox="0 0 16 16" width="14" height="14">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
            <path fill="currentColor" d="M8 4v4.5l3 1.75"/>
          </svg>
        </span>
      `;
    }
  }
  
  return `
    <div class="chat-message ${messageClass}" data-message-id="${message.id}">
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
    
    // Buscar ticket para pegar o número do destinatário
    const ticket = await apiFetch(`/tickets/${currentTicketId}`);
    
    // Enviar mensagem
    const message = {
      ticketId: currentTicketId,
      to: ticket.userPhone,  // ✅ Campo obrigatório!
      body: body,
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
    
    // Adicionar mensagem ao chat localmente
    // A API retorna { message: {...}, success: true }
    const sentMessage = response.message || response;
    addMessageToChat(sentMessage);
    
    // Limpar input
    textarea.value = '';
    clearFileSelection();
    autoResizeTextarea(textarea);
    
    // Scroll para o final
    scrollToBottom();
    
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
  const message = data.message || data;
  
  if (data.ticketId === currentTicketId || message.ticketId === currentTicketId) {
    addMessageToChat(message);
    
    // Marcar como lida
    markMessagesAsRead(currentTicketId);
  } else {
    // Atualizar badge
    updateChatItemUnread(data.ticketId || message.ticketId);
  }
  
  // Atualizar lista de conversas
  loadChats();
}

/**
 * Adiciona mensagem ao chat
 */
function addMessageToChat(message) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;
  
  // Se container está vazio (mensagem inicial), limpar placeholder
  if (messagesContainer.querySelector('.text-center')) {
    messagesContainer.innerHTML = '';
  }
  
  const messageHtml = renderMessage(message);
  if (messageHtml) {
    messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
    scrollToBottom();
  }
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
    // apiFetch já faz JSON.stringify automaticamente
    await apiFetch('/chat/messages/read', {
      method: 'POST',
      body: { ticketId }
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
    await apiFetch(`/tickets/${currentTicketId}`, {
      method: 'PATCH',
      body: { status: 'closed' }
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
 * Mostra notificação de novo ticket
 */
function showTicketNotification(data) {
  // Criar notificação sonora e visual
  const notification = document.createElement('div');
  notification.className = 'alert alert-info alert-dismissible fade show position-fixed top-0 end-0 m-3';
  notification.style.zIndex = '9999';
  notification.style.minWidth = '300px';
  notification.innerHTML = `
    <h6><i class="bi bi-bell-fill"></i> Novo Cliente Aguardando!</h6>
    <p class="mb-2"><strong>${data.ticket.userName || 'Cliente'}</strong></p>
    <p class="mb-3 small">${data.message || 'Nova conversa'}</p>
    <div class="d-grid gap-2">
      <button class="btn btn-success btn-sm" onclick="acceptTicketFromNotification(${data.ticket.id})">
        <i class="bi bi-check-circle"></i> Aceitar Atendimento
      </button>
      <button class="btn btn-secondary btn-sm" onclick="rejectTicketFromNotification(${data.ticket.id})">
        <i class="bi bi-x-circle"></i> Rejeitar
      </button>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  
  document.body.appendChild(notification);
  
  // Tocar som de notificação (opcional)
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dtv24gBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dtv24gBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dtv24gBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dtv24g');
    audio.play().catch(() => {}); // Ignorar erro se não conseguir tocar
  } catch (e) {}
  
  // Auto-remover após 30 segundos
  setTimeout(() => {
    notification.remove();
  }, 30000);
}

/**
 * Aceitar ticket pela notificação
 */
async function acceptTicketFromNotification(ticketId) {
  await acceptTicket(ticketId);
  // Carregar o ticket automaticamente
  await loadTicket(ticketId);
}

/**
 * Rejeitar ticket pela notificação
 */
async function rejectTicketFromNotification(ticketId) {
  await rejectTicket(ticketId);
}

/**
 * Aceitar ticket (atendimento humano)
 */
async function acceptTicket(ticketId) {
  try {
    showLoading();
    
    const response = await apiFetch(`/tickets/${ticketId}/accept`, {
      method: 'POST'
    });
    
    showToast('✅ Atendimento aceito! Você está atendendo este cliente.', 'success');
    
    // Recarregar ticket
    await loadTicket(ticketId);
    await loadChats();
    
    hideLoading();
  } catch (error) {
    console.error('❌ Erro ao aceitar ticket:', error);
    showToast('Erro ao aceitar atendimento', 'error');
    hideLoading();
  }
}

/**
 * Rejeitar ticket (IA assume)
 */
async function rejectTicket(ticketId) {
  try {
    if (!confirm('Deseja rejeitar este atendimento? A IA assumirá automaticamente.')) return;
    
    showLoading();
    
    const response = await apiFetch(`/tickets/${ticketId}/reject`, {
      method: 'POST'
    });
    
    showToast('⏭️ Atendimento rejeitado. IA assumiu o atendimento.', 'info');
    
    // Recarregar lista de chats
    await loadChats();
    
    // Limpar chat atual
    currentTicketId = null;
    document.getElementById('chatEmptyState').style.display = 'flex';
    document.getElementById('chatHeader').style.display = 'none';
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatInputArea').style.display = 'none';
    
    hideLoading();
  } catch (error) {
    console.error('❌ Erro ao rejeitar ticket:', error);
    showToast('Erro ao rejeitar atendimento', 'error');
    hideLoading();
  }
}

/**
 * Finalizar ticket (encerrar atendimento)
 */
async function finishTicket(ticketId) {
  try {
    // Modal para feedback (opcional)
    const feedback = prompt('Deseja adicionar um comentário sobre este atendimento? (Opcional)');
    
    showLoading();
    
    const response = await apiFetch(`/tickets/${ticketId}/finish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        feedback: feedback || null
      })
    });
    
    showToast('✅ Atendimento finalizado com sucesso!', 'success');
    
    // Recarregar lista de chats
    await loadChats();
    
    // Limpar chat atual
    currentTicketId = null;
    document.getElementById('chatEmptyState').style.display = 'flex';
    document.getElementById('chatHeader').style.display = 'none';
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('chatInputArea').style.display = 'none';
    
    hideLoading();
  } catch (error) {
    console.error('❌ Erro ao finalizar ticket:', error);
    showToast('Erro ao finalizar atendimento', 'error');
    hideLoading();
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

