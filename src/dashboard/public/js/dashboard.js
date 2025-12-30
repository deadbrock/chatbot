// Dashboard JavaScript

// Configuração
const API_BASE_URL = '/api';
let socket;
let charts = {};
let currentTicket = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    // Verificar autenticação
    if (!checkAuth()) return;

    // Mostrar usuário
    hydrateUser();

    // Conectar Socket.IO
    connectSocket();

    // Carregar dados iniciais
    loadDashboardData();

    // Event Listeners
    setupEventListeners();

    // Auto-refresh a cada 30 segundos
    setInterval(loadDashboardData, 30000);
}

function hydrateUser() {
    try {
        const userRaw = localStorage.getItem('user');
        if (!userRaw) return;
        const user = JSON.parse(userRaw);
        document.getElementById('userName').textContent = user?.name || 'Usuário';
    } catch (_) {}
}

// Autenticação
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Socket.IO
function connectSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('✅ Socket.IO conectado');
    });

    socket.on('disconnect', () => {
        console.log('❌ Socket.IO desconectado');
    });

    // Eventos em tempo real
    socket.on('new_ticket', (data) => {
        showNotification('Novo Ticket', `Ticket ${data.protocol} criado`);
        loadDashboardData();
    });

    socket.on('ticket_updated', (data) => {
        loadDashboardData();
    });

    socket.on('new_session', (data) => {
        loadDashboardData();
    });
}

// Carregar dados do dashboard
async function loadDashboardData() {
    try {
        // Estatísticas principais
        const dashboardData = await fetchAPI('/analytics/dashboard');
        updateDashboardStats(dashboardData);

        // Tickets recentes
        const tickets = await fetchAPI('/tickets?limit=10');
        updateRecentTickets(tickets);

        // Gráficos
        await loadCharts();

        // Status do sistema
        await checkSystemStatus();

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Erro', 'Não foi possível carregar dados do dashboard.', 'danger');
    }
}

// Atualizar estatísticas
function updateDashboardStats(data) {
    document.getElementById('ticketsToday').textContent = data.ticketsToday || 0;
    document.getElementById('ticketsOpen').textContent = data.ticketsOpen || 0;
    document.getElementById('sessionsActive').textContent = data.sessionsActive || 0;
    document.getElementById('agentsOnline').textContent = data.agentsOnline || 0;

    // Badges
    document.getElementById('ticketsBadge').textContent = data.ticketsOpen || 0;
    document.getElementById('sessionsBadge').textContent = data.sessionsActive || 0;
}

// Atualizar tabela de tickets recentes
function updateRecentTickets(tickets) {
    const tbody = document.getElementById('recentTicketsTable');
    
    if (!tickets || tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum ticket encontrado</td></tr>';
        return;
    }

    tbody.innerHTML = tickets.map(ticket => `
        <tr>
            <td><strong>${ticket.protocol}</strong></td>
            <td>${ticket.userName || 'N/A'}</td>
            <td>${ticket.department || 'N/A'}</td>
            <td><span class="status-badge status-${ticket.status}">${formatStatus(ticket.status)}</span></td>
            <td>${formatDate(ticket.createdAt)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewTicket('${ticket.id}')">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Carregar gráficos
async function loadCharts() {
    try {
        // Gráfico de timeline
        const timelineData = await fetchAPI('/analytics/tickets/timeline?days=30');
        createTimelineChart(timelineData);

        // Gráfico de status
        const statusData = await fetchAPI('/analytics/tickets/by-status');
        createStatusChart(statusData);

    } catch (error) {
        console.error('Erro ao carregar gráficos:', error);
    }
}

// Criar gráfico de timeline
function createTimelineChart(data) {
    const ctx = document.getElementById('ticketsChart');
    
    if (charts.timeline) {
        charts.timeline.destroy();
    }

    const labels = data.map(d => formatDate(d._id));
    const values = data.map(d => d.count);

    charts.timeline = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tickets',
                data: values,
                borderColor: 'rgb(13, 110, 253)',
                backgroundColor: 'rgba(13, 110, 253, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Criar gráfico de status
function createStatusChart(data) {
    const ctx = document.getElementById('statusChart');
    
    if (charts.status) {
        charts.status.destroy();
    }

    const labels = data.map(d => formatStatus(d._id));
    const values = data.map(d => d.count);
    const colors = [
        'rgb(13, 202, 240)',
        'rgb(255, 193, 7)',
        'rgb(25, 135, 84)',
        'rgb(108, 117, 125)'
    ];

    charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Verificar status do sistema
async function checkSystemStatus() {
    try {
        const response = await fetch('/health');
        const data = await response.json();

        document.getElementById('whatsappStatus').textContent = data.whatsapp ? 'Online' : 'Offline';
        document.getElementById('dbStatus').textContent = data.database ? 'Online' : 'Offline';

    } catch (error) {
        console.error('Erro ao verificar status:', error);
    }
}

// Event Listeners
function setupEventListeners() {
    // Navegação
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            navigateToSection(section);
        });
    });

    // Refresh
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadDashboardData();
        showToast('Atualizado', 'Dados atualizados com sucesso.', 'success');
    });

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    // Tickets
    document.getElementById('refreshTicketsBtn')?.addEventListener('click', () => loadTicketsSection());
    document.getElementById('ticketStatusFilter')?.addEventListener('change', () => loadTicketsSection());
    document.getElementById('ticketSearch')?.addEventListener('input', debounce(() => renderTicketsTable(lastTickets), 150));
    document.getElementById('ticketModalSaveBtn')?.addEventListener('click', saveTicketFromModal);

    // Sessões
    document.getElementById('refreshSessionsBtn')?.addEventListener('click', () => loadSessionsSection());

    // Atendentes
    document.getElementById('refreshAgentsBtn')?.addEventListener('click', () => loadAgentsSection());
    document.getElementById('newAgentBtn')?.addEventListener('click', () => {
        const modal = new bootstrap.Modal(document.getElementById('newAgentModal'));
        modal.show();
    });
    document.getElementById('createAgentBtn')?.addEventListener('click', createAgent);

    // Analytics
    document.getElementById('refreshAnalyticsBtn')?.addEventListener('click', () => loadAnalyticsSection());
}

// Navegação entre seções
function navigateToSection(section) {
    // Remover active de todos
    document.querySelectorAll('.content-section').forEach(s => {
        s.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
    });

    // Adicionar active na seção
    document.getElementById(`${section}Section`)?.classList.add('active');
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

    // Carregar dados específicos da seção
    loadSectionData(section);
}

// Carregar dados de seção específica
async function loadSectionData(section) {
    switch(section) {
        case 'tickets':
            await loadTicketsSection();
            break;
        case 'sessions':
            await loadSessionsSection();
            break;
        case 'agents':
            await loadAgentsSection();
            break;
        case 'analytics':
            await loadAnalyticsSection();
            break;
    }
}

// Funções auxiliares
async function fetchAPI(endpoint, options = {}) {
    const response = await fetch(API_BASE_URL + endpoint, {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            logout();
        }
        const text = await response.text().catch(() => '');
        throw new Error(text || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data || data;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatStatus(status) {
    const statusMap = {
        'open': 'Aberto',
        'waiting_human': 'Aguardando',
        'in_progress': 'Em Progresso',
        'resolved': 'Resolvido',
        'closed': 'Fechado'
    };
    return statusMap[status] || status;
}

function showToast(title, message, variant = 'primary') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${variant} border-0`;
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong class="me-1">${escapeHtml(title)}</strong>
                <span>${escapeHtml(message)}</span>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
        </div>
    `;
    container.appendChild(el);
    const toast = new bootstrap.Toast(el, { delay: 3200 });
    toast.show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}

function viewTicket(ticketId) {
    openTicketModal(ticketId);
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}

// ========= Tickets =========
let lastTickets = [];

async function loadTicketsSection() {
    try {
        const status = document.getElementById('ticketStatusFilter')?.value || '';
        const qs = new URLSearchParams();
        if (status) qs.set('status', status);
        qs.set('limit', '200');
        const tickets = await fetchAPI(`/tickets?${qs.toString()}`);
        lastTickets = tickets || [];
        renderTicketsTable(lastTickets);
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Não foi possível carregar tickets.', 'danger');
    }
}

function renderTicketsTable(tickets) {
    const tbody = document.getElementById('ticketsTableBody');
    if (!tbody) return;

    const q = (document.getElementById('ticketSearch')?.value || '').trim().toLowerCase();
    const filtered = !q ? tickets : tickets.filter(t => {
        const hay = `${t.protocol} ${t.userName || ''} ${t.userId || ''} ${t.department || ''}`.toLowerCase();
        return hay.includes(q);
    });

    if (!filtered || filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum ticket encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => `
        <tr>
          <td class="fw-semibold">${escapeHtml(t.protocol)}</td>
          <td>${escapeHtml(t.userName || '—')}</td>
          <td>${escapeHtml(t.department || '—')}</td>
          <td><span class="status-badge status-${escapeHtml(t.status)}">${escapeHtml(formatStatus(t.status))}</span></td>
          <td>${escapeHtml(formatDate(t.updatedAt || t.createdAt))}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-primary" onclick="viewTicket('${t.id}')">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>
    `).join('');
}

async function openTicketModal(ticketId) {
    try {
        const ticket = await fetchAPI(`/tickets/${ticketId}`);
        currentTicket = ticket;

        document.getElementById('ticketModalProtocol').textContent = ticket.protocol || '';
        document.getElementById('ticketModalUser').textContent = ticket.userName || ticket.userId || '—';
        document.getElementById('ticketModalDept').textContent = ticket.department || '—';
        document.getElementById('ticketModalStatus').value = ticket.status || 'open';
        document.getElementById('ticketModalDesc').textContent = ticket.description || ticket.subject || '—';

        const timeline = document.getElementById('ticketModalTimeline');
        const msgs = ticket.messages || [];
        if (!timeline) return;
        if (!msgs.length) {
            timeline.innerHTML = `<div class="text-muted">Sem histórico registrado.</div>`;
        } else {
            timeline.innerHTML = msgs.slice().reverse().map(m => `
                <div class="ticket-event">
                  <div class="meta">
                    <span>${escapeHtml(m.isBot ? 'Bot' : (m.from || 'Usuário'))}</span>
                    <span>${escapeHtml(formatDate(m.timestamp || ticket.createdAt))}</span>
                  </div>
                  <div class="msg">${escapeHtml(m.message || '')}</div>
                </div>
            `).join('');
        }

        const modal = new bootstrap.Modal(document.getElementById('ticketModal'));
        modal.show();
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Não foi possível abrir o ticket.', 'danger');
    }
}

async function saveTicketFromModal() {
    if (!currentTicket) return;
    const status = document.getElementById('ticketModalStatus')?.value || currentTicket.status;
    try {
        await fetchAPI(`/tickets/${currentTicket.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        showToast('Salvo', 'Ticket atualizado com sucesso.', 'success');
        await loadTicketsSection();
        await loadDashboardData();
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Falha ao salvar ticket.', 'danger');
    }
}

// ========= Sessões =========
async function loadSessionsSection() {
    try {
        const sessions = await fetchAPI('/sessions');
        const tbody = document.getElementById('sessionsTableBody');
        if (!tbody) return;
        if (!sessions || sessions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhuma sessão ativa.</td></tr>`;
            return;
        }
        tbody.innerHTML = sessions.map(s => `
          <tr>
            <td class="text-muted">${escapeHtml(s.userId)}</td>
            <td class="fw-semibold">${escapeHtml(s.userName || '—')}</td>
            <td>${escapeHtml(s.currentDepartment || '—')}</td>
            <td>${escapeHtml(String(s.interactionCount ?? 0))}</td>
            <td>${escapeHtml(formatDate(s.lastInteraction || s.updatedAt || s.createdAt))}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-danger" onclick="expireSession('${escapeHtml(s.userId)}')">
                <i class="bi bi-x-circle"></i>
              </button>
            </td>
          </tr>
        `).join('');
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Não foi possível carregar sessões.', 'danger');
    }
}

async function expireSession(userId) {
    if (!confirm('Deseja expirar esta sessão?')) return;
    try {
        await fetchAPI(`/sessions/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        showToast('Ok', 'Sessão expirada.', 'success');
        await loadSessionsSection();
        await loadDashboardData();
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Falha ao expirar sessão.', 'danger');
    }
}

// ========= Atendentes =========
async function loadAgentsSection() {
    try {
        const users = await fetchAPI('/users');
        const tbody = document.getElementById('agentsTableBody');
        if (!tbody) return;
        if (!users || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum usuário encontrado.</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(u => `
          <tr>
            <td class="fw-semibold">${escapeHtml(u.name || '—')}</td>
            <td class="text-muted">${escapeHtml(u.email || '—')}</td>
            <td>${escapeHtml(u.role || '—')}</td>
            <td>${escapeHtml(u.status || 'offline')}</td>
            <td>${escapeHtml(u.department || '—')}</td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-secondary" onclick="setAgentStatus(${u.id}, 'online')">Online</button>
              <button class="btn btn-sm btn-outline-secondary" onclick="setAgentStatus(${u.id}, 'offline')">Offline</button>
            </td>
          </tr>
        `).join('');
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Não foi possível carregar atendentes.', 'danger');
    }
}

async function setAgentStatus(id, status) {
    try {
        await fetchAPI(`/users/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        showToast('Ok', 'Status atualizado.', 'success');
        await loadAgentsSection();
        await loadDashboardData();
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Falha ao atualizar status.', 'danger');
    }
}

async function createAgent() {
    const form = document.getElementById('newAgentForm');
    if (!form) return;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    try {
        await fetchAPI('/users', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        showToast('Criado', 'Atendente criado com sucesso.', 'success');
        form.reset();
        bootstrap.Modal.getInstance(document.getElementById('newAgentModal'))?.hide();
        await loadAgentsSection();
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Falha ao criar atendente.', 'danger');
    }
}

// ========= Analytics =========
async function loadAnalyticsSection() {
    try {
        const byDept = await fetchAPI('/analytics/tickets/by-department');
        const ratings = await fetchAPI('/analytics/ratings');
        const perf = await fetchAPI('/analytics/agents/performance');

        renderByDepartmentChart(byDept || []);
        renderRatingsChart(ratings || []);
        renderAgentsPerf(perf || []);
    } catch (e) {
        console.error(e);
        showToast('Erro', 'Não foi possível carregar analytics.', 'danger');
    }
}

function renderByDepartmentChart(rows) {
    const el = document.getElementById('byDepartmentChart');
    if (!el) return;
    if (charts.byDepartment) charts.byDepartment.destroy();

    const labels = rows.map(r => r._id || '—');
    const values = rows.map(r => Number(r.count || 0));

    charts.byDepartment = new Chart(el, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tickets',
                data: values,
                backgroundColor: 'rgba(13,110,253,0.35)',
                borderColor: 'rgba(13,110,253,0.85)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

function renderRatingsChart(rows) {
    const el = document.getElementById('ratingsChart');
    if (!el) return;
    if (charts.ratings) charts.ratings.destroy();

    const labels = rows.map(r => `${r._id}★`);
    const values = rows.map(r => Number(r.count || 0));

    charts.ratings = new Chart(el, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: ['#dc3545','#fd7e14','#ffc107','#20c997','#198754'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderAgentsPerf(rows) {
    const tbody = document.getElementById('agentsPerfTableBody');
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sem dados.</td></tr>`;
        return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="fw-semibold">${escapeHtml(r.agentName || '—')}</td>
        <td>${escapeHtml(String(r.totalTickets ?? 0))}</td>
        <td>${escapeHtml(String(r.resolved ?? 0))}</td>
        <td>${escapeHtml(Number(r.avgRating || 0).toFixed(2))}</td>
      </tr>
    `).join('');
}

// ========= Helpers =========
function debounce(fn, delayMs) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delayMs);
    };
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

