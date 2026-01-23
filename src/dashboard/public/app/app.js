import { ensureAuth, getStoredUser, logout } from './auth.js';
import { apiFetch } from './api.js';
import { createToast } from './ui/toast.js';
import { escapeHtml, debounce } from './ui/dom.js';
import { initRouter, navigateToSection } from './router.js';
import { connectSocket } from './socket.js';
import { initMenuController } from './menuController.js';
import { renderDashboard, renderDashboardCharts, renderRankings, renderAdditionalCharts } from './views/dashboardView.js';
import { renderTickets, openTicketModal } from './views/ticketsView.js';
import { renderSessions } from './views/sessionsView.js';
import { renderAgents } from './views/agentsView.js';
import { renderAnalytics } from './views/analyticsView.js';
import { loadSettingsView } from './views/settingsView.js';
import { renderKanban } from './views/kanbanView.js';
import { renderTags } from './views/tagsView.js';
import { renderSchedules } from './views/schedulesView.js';
import { renderContacts } from './views/contactsView.js';
import { renderTicketStatuses } from './views/ticketStatusesView.js';
import { renderQueues } from './views/queuesView.js';
import { initCampaignsView } from './views/campaignsView.js';
import { initAdministrationView } from './views/administrationView.js';
import { initChatView, cleanupChatView } from './views/chatView.js';
import { initExecutiveDashboardView, cleanupExecutiveDashboardView } from './views/executiveDashboardView.js';
import { initThemeToggle } from './theme.js';

// 🌐 EXPORTAR apiFetch para window (para scripts não-módulos como aiPlaygroundView.js)
window.apiFetch = apiFetch;

const state = {
  tickets: [],
  sessions: [],
  agents: []
};

function hydrateUser() {
  const user = getStoredUser();
  if (user?.name) {
    const el = document.getElementById('userName');
    if (el) el.textContent = user.name;
  }
}

function wireEvents() {
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    await loadDashboard();
    createToast({ title: 'Atualizado', message: 'Dados atualizados com sucesso.', variant: 'success' });
  });

  // Tickets
  document.getElementById('refreshTicketsBtn')?.addEventListener('click', () => loadTickets());
  document.getElementById('ticketStatusFilter')?.addEventListener('change', () => loadTickets());
  document.getElementById('ticketSearch')?.addEventListener('input', debounce(() => {
    renderTickets({ tickets: state.tickets, apiFetch, createToast, escapeHtml });
  }, 150));
  document.getElementById('ticketModalSaveBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('ticketModal')?.dataset?.ticketId;
    if (!id) return;
    const status = document.getElementById('ticketModalStatus')?.value;
    try {
      await apiFetch(`/tickets/${id}`, { method: 'PATCH', body: { status } });
      createToast({ title: 'Salvo', message: 'Ticket atualizado com sucesso.', variant: 'success' });
      await loadTickets();
      await loadDashboard();
    } catch (e) {
      createToast({ title: 'Erro', message: e?.message || 'Falha ao salvar ticket.', variant: 'danger' });
    }
  });

  // Botão "Iniciar Conversa" no modal do ticket
  document.getElementById('ticketModalChatBtn')?.addEventListener('click', () => {
    const ticketId = document.getElementById('ticketModal')?.dataset?.ticketId;
    if (!ticketId) return;
    
    // Fechar o modal
    const modal = window.bootstrap.Modal.getInstance(document.getElementById('ticketModal'));
    if (modal) modal.hide();
    
    // Navegar para a aba Chat
    navigateToSection('chat');
    
    // Disparar evento para abrir o chat do ticket
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openChat', { detail: { ticketId } }));
    }, 300);
  });

  // Abrir ticket a partir de qualquer lugar (ex: tabela de recentes no dashboard)
  window.addEventListener('openTicket', async (ev) => {
    const ticketId = ev?.detail?.ticketId;
    if (!ticketId) return;
    await openTicketModal({ ticketId, apiFetch, createToast, escapeHtml });
  });

  // Sessões
  document.getElementById('refreshSessionsBtn')?.addEventListener('click', () => loadSessions());

  // Atendentes
  document.getElementById('refreshAgentsBtn')?.addEventListener('click', () => loadAgents());
  document.getElementById('newAgentBtn')?.addEventListener('click', () => {
    const modalEl = document.getElementById('newAgentModal');
    if (!modalEl) return;
    const modal = new window.bootstrap.Modal(modalEl);
    modal.show();
  });
  document.getElementById('createAgentBtn')?.addEventListener('click', async () => {
    const form = document.getElementById('newAgentForm');
    if (!form) return;
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    try {
      await apiFetch('/users', { method: 'POST', body: payload });  // ✅ apiFetch já faz JSON.stringify!
      createToast({ title: 'Criado', message: 'Atendente criado com sucesso.', variant: 'success' });
      form.reset();
      window.bootstrap.Modal.getInstance(document.getElementById('newAgentModal'))?.hide();
      await loadAgents();
    } catch (e) {
      createToast({ title: 'Erro', message: e?.message || 'Falha ao criar atendente.', variant: 'danger' });
    }
  });

  // Analytics
  document.getElementById('refreshAnalyticsBtn')?.addEventListener('click', () => loadAnalytics());
}

async function loadDashboard() {
  const [dashboardData, tickets, timelineRows, statusRows, extendedMetrics, npsData, contactsRanking, agentsRanking] = await Promise.all([
    apiFetch('/analytics/dashboard'),
    apiFetch('/tickets?limit=10'),
    apiFetch('/analytics/tickets/timeline?days=30'),
    apiFetch('/analytics/tickets/by-status'),
    apiFetch('/analytics/metrics/extended').catch(() => null),
    apiFetch('/nps/score').catch(() => null),
    apiFetch('/analytics/rankings/contacts?limit=10').catch(() => null),
    apiFetch('/analytics/rankings/agents').catch(() => null)
  ]);

  renderDashboard({ data: dashboardData, tickets, extendedMetrics, npsData, escapeHtml });
  renderDashboardCharts({ 
    timelineRows: Array.isArray(timelineRows) ? timelineRows : (timelineRows?.data || []), 
    statusRows: Array.isArray(statusRows) ? statusRows : (statusRows?.data || [])
  });
  
  // Renderizar rankings
  if (contactsRanking || agentsRanking) {
    renderRankings({ contacts: contactsRanking, agents: agentsRanking });
  }
  
  // Renderizar gráficos adicionais
  await renderAdditionalCharts({ apiFetch });
  
  await checkSystemStatus();
}

async function loadTickets() {
  const status = document.getElementById('ticketStatusFilter')?.value || '';
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  qs.set('limit', '200');

  state.tickets = await apiFetch(`/tickets?${qs.toString()}`);
  renderTickets({ tickets: state.tickets, apiFetch, createToast, escapeHtml });
}

async function loadSessions() {
  state.sessions = await apiFetch('/sessions');
  renderSessions({ sessions: state.sessions, apiFetch, createToast, escapeHtml });
}

async function loadAgents() {
  state.agents = await apiFetch('/users');
  renderAgents({ agents: state.agents, apiFetch, createToast, escapeHtml });
}

async function loadAnalytics() {
  const [byDeptResp, ratingsResp, perfResp] = await Promise.all([
    apiFetch('/analytics/tickets/by-department'),
    apiFetch('/analytics/ratings'),
    apiFetch('/analytics/agents/performance')
  ]);

  // Normalizar dados para arrays
  const byDept = Array.isArray(byDeptResp) ? byDeptResp : (byDeptResp?.data || []);
  const ratings = Array.isArray(ratingsResp) ? ratingsResp : (ratingsResp?.data || []);
  const perf = Array.isArray(perfResp) ? perfResp : (perfResp?.data || []);

  renderAnalytics({ byDept, ratings, perf, createToast, escapeHtml });
}

async function loadKanban() {
  await renderKanban({ apiFetch, createToast, escapeHtml });
}

async function loadTags() {
  await renderTags({ apiFetch, createToast, escapeHtml });
}

async function loadChat() {
  await initChatView();
}

async function loadSchedules() {
  await renderSchedules({ apiFetch, createToast, escapeHtml });
}

async function loadContacts() {
  await renderContacts();
}

async function loadTicketStatuses() {
  await renderTicketStatuses();
}

async function loadQueues() {
  await renderQueues();
}

async function loadCampaigns() {
  await initCampaignsView();
}

async function loadAIPlayground() {
  console.log('🔍 Tentando carregar AI Playground...');
  console.log('🔍 window.aiPlaygroundView existe?', !!window.aiPlaygroundView);
  
  // Aguardar um pouco caso o script ainda esteja carregando
  if (!window.aiPlaygroundView) {
    console.log('⏳ Aguardando carregamento do AI Playground...');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Usar a instância global do aiPlaygroundView
  if (window.aiPlaygroundView) {
    console.log('✅ AI Playground encontrado, renderizando...');
    const aiPlaygroundSection = document.getElementById('ai-playgroundSection');
    if (aiPlaygroundSection) {
      aiPlaygroundSection.innerHTML = '<div id="main-content"></div>';
      window.aiPlaygroundView.render();
      console.log('✅ AI Playground renderizado com sucesso!');
    } else {
      console.error('❌ Seção #ai-playgroundSection não encontrada no DOM');
    }
  } else {
    console.error('❌ AI Playground View não está disponível após aguardar');
    console.error('❌ Verifique se o script /app/views/aiPlaygroundView.js foi carregado');
    createToast({ title: 'Erro', message: 'AI Playground não está disponível. Recarregue a página.', variant: 'danger' });
  }
}

async function loadAutomations() {
  console.log('🔍 Tentando carregar Automações...');
  console.log('🔍 window.automationsView existe?', !!window.automationsView);
  
  // Aguardar um pouco caso o script ainda esteja carregando
  if (!window.automationsView) {
    console.log('⏳ Aguardando carregamento de Automações...');
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Usar a instância global do automationsView
  if (window.automationsView) {
    console.log('✅ Automações encontrado, renderizando...');
    const automationsSection = document.getElementById('automationsSection');
    if (automationsSection) {
      automationsSection.innerHTML = '<div id="content"></div>';
      await window.automationsView.render();
      console.log('✅ Automações renderizado com sucesso!');
    } else {
      console.error('❌ Seção #automationsSection não encontrada no DOM');
    }
  } else {
    console.error('❌ Automations View não está disponível após aguardar');
    console.error('❌ Verifique se o script /app/views/automationsView.js foi carregado');
    createToast({ title: 'Erro', message: 'Automações não está disponível. Recarregue a página.', variant: 'danger' });
  }
}

async function loadAdministration() {
  await initAdministrationView();
}

async function loadExecutiveDashboard() {
  await initExecutiveDashboardView();
}

async function checkSystemStatus() {
  try {
    const resp = await fetch('/health');
    const json = await resp.json();
    document.getElementById('whatsappStatus').textContent = json.whatsapp ? 'Online' : 'Offline';
    document.getElementById('dbStatus').textContent = json.database ? 'Online' : 'Offline';
  } catch (_) {
    // silencioso
  }
}

async function onSectionChange(section) {
  switch (section) {
    case 'dashboard':
      await loadDashboard();
      break;
    case 'tickets':
      await loadTickets();
      break;
    case 'sessions':
      await loadSessions();
      break;
    case 'agents':
      await loadAgents();
      break;
    case 'analytics':
      await loadAnalytics();
      break;
    case 'kanban':
      await loadKanban();
      break;
    case 'tags':
      await loadTags();
      break;
    case 'chat':
      await loadChat();
      break;
    case 'schedules':
      await loadSchedules();
      break;
    case 'contacts':
      await loadContacts();
      break;
    case 'ticketStatuses':
      await loadTicketStatuses();
      break;
    case 'queues':
      await loadQueues();
      break;
    case 'campaigns':
      await loadCampaigns();
      break;
    case 'ai-playground':
      await loadAIPlayground();
      break;
    case 'automations':
      await loadAutomations();
      break;
    case 'administration':
      await loadAdministration();
      break;
    case 'executive-dashboard':
      await loadExecutiveDashboard();
      break;
    case 'settings':
      await loadSettingsView();
      break;
  }
}

async function init() {
  if (!ensureAuth()) return;
  initThemeToggle();
  initMenuController();
  hydrateUser();
  wireEvents();
  initRouter(onSectionChange);

  connectSocket({
    onNewTicket: (data) => {
      createToast({ title: 'Novo ticket', message: `Ticket ${data.protocol} criado.`, variant: 'primary' });
      loadDashboard();
      // se estiver na aba tickets, atualiza também
      if (location.hash.includes('tickets')) loadTickets();
    },
    onTicketUpdated: () => {
      loadDashboard();
      if (location.hash.includes('tickets')) loadTickets();
    },
    onNewSession: () => {
      loadDashboard();
      if (location.hash.includes('sessions')) loadSessions();
    }
  });

  // primeira carga baseada no hash
  const initial = (location.hash || '#dashboard').replace('#', '');
  navigateToSection(initial);
}

init().catch((e) => {
  console.error(e);
  createToast({ title: 'Erro', message: e?.message || 'Falha ao iniciar painel.', variant: 'danger' });
});


