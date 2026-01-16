import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';

/**
 * View de Automações (Fluxos, Follow-ups, Gatilhos)
 */

export async function renderAutomations() {
  console.log('Renderizando Automações...');
  
  // Aguardar tabs serem renderizadas
  setTimeout(() => {
    // Carregar fluxos por padrão
    loadFlows();
    
    // Event listeners para tabs
    document.getElementById('flows-tab')?.addEventListener('click', loadFlows);
    document.getElementById('followups-tab')?.addEventListener('click', loadFollowUps);
    document.getElementById('triggers-tab')?.addEventListener('click', loadTriggers);
  }, 100);
}

// ==================== FLUXOS DE CAMPANHA ====================

async function loadFlows() {
  const container = document.getElementById('flowsContent');
  if (!container) return;
  
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h3><i class="bi bi-diagram-3"></i> Fluxos de Campanha</h3>
        <p class="text-muted mb-0">Crie fluxos automatizados multi-etapas para suas campanhas</p>
      </div>
      <button class="btn btn-primary" id="newFlowBtn">
        <i class="bi bi-plus-circle"></i> Novo Fluxo
      </button>
    </div>
    
    <div class="row mb-3">
      <div class="col-md-6">
        <input type="text" class="form-control" id="flowSearch" placeholder="Buscar fluxos...">
      </div>
      <div class="col-md-3">
        <select class="form-select" id="flowStatusFilter">
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="active">Ativo</option>
          <option value="paused">Pausado</option>
          <option value="completed">Concluído</option>
        </select>
      </div>
    </div>
    
    <div id="flowsListContainer" class="row g-3">
      <div class="col-12 text-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
    </div>
  `;
  
  // Event listeners
  document.getElementById('newFlowBtn')?.addEventListener('click', () => openFlowModal());
  document.getElementById('flowSearch')?.addEventListener('input', debounce(() => fetchFlows(), 300));
  document.getElementById('flowStatusFilter')?.addEventListener('change', () => fetchFlows());
  
  // Carregar dados
  fetchFlows();
}

async function fetchFlows() {
  const container = document.getElementById('flowsListContainer');
  if (!container) return;
  
  try {
    const search = document.getElementById('flowSearch')?.value || '';
    const status = document.getElementById('flowStatusFilter')?.value || '';
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    
    const response = await apiFetch(`/campaign-flows?${params}`);
    
    if (response.success && response.data.flows) {
      renderFlowsList(response.data.flows);
    } else {
      throw new Error(response.message || 'Erro ao carregar fluxos');
    }
  } catch (error) {
    console.error('Erro ao buscar fluxos:', error);
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle"></i> Erro ao carregar fluxos: ${error.message}
        </div>
      </div>
    `;
  }
}

function renderFlowsList(flows) {
  const container = document.getElementById('flowsListContainer');
  
  if (flows.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="alert alert-info text-center">
          <i class="bi bi-info-circle"></i> Nenhum fluxo encontrado. Crie seu primeiro fluxo!
        </div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = flows.map(flow => `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="card-title mb-0">${flow.name}</h5>
            <span class="badge ${getFlowStatusBadge(flow.status)}">${getFlowStatusText(flow.status)}</span>
          </div>
          <p class="card-text text-muted small">${flow.description || 'Sem descrição'}</p>
          
          <div class="d-flex justify-content-between text-muted small mb-3">
            <span><i class="bi bi-layers"></i> ${flow.steps?.length || 0} etapas</span>
            <span><i class="bi bi-play-circle"></i> ${flow.currentExecutions || 0} execuções</span>
          </div>
          
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary flex-fill" onclick="window.viewFlow('${flow.id}')">
              <i class="bi bi-eye"></i> Ver
            </button>
            <button class="btn btn-sm btn-outline-success" onclick="window.toggleFlowStatus('${flow.id}', '${flow.status}')">
              <i class="bi bi-${flow.status === 'active' ? 'pause' : 'play'}-circle"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="window.duplicateFlow('${flow.id}')">
              <i class="bi bi-files"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="window.deleteFlow('${flow.id}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function openFlowModal(flowId = null) {
  showToast('Modal de fluxo em desenvolvimento', 'info');
  // TODO: Implementar modal visual de fluxo
}

function getFlowStatusBadge(status) {
  const badges = {
    draft: 'bg-secondary',
    active: 'bg-success',
    paused: 'bg-warning',
    completed: 'bg-info',
    archived: 'bg-dark'
  };
  return badges[status] || 'bg-secondary';
}

function getFlowStatusText(status) {
  const texts = {
    draft: 'Rascunho',
    active: 'Ativo',
    paused: 'Pausado',
    completed: 'Concluído',
    archived: 'Arquivado'
  };
  return texts[status] || status;
}

// ==================== FOLLOW-UPS ====================

async function loadFollowUps() {
  const container = document.getElementById('followupsContent');
  if (!container) return;
  
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h3><i class="bi bi-arrow-repeat"></i> Follow-ups Automáticos</h3>
        <p class="text-muted mb-0">Configure lembretes e reengajamento automático</p>
      </div>
      <button class="btn btn-primary" id="newFollowUpBtn">
        <i class="bi bi-plus-circle"></i> Novo Follow-up
      </button>
    </div>
    
    <div class="row mb-3">
      <div class="col-md-6">
        <input type="text" class="form-control" id="followUpSearch" placeholder="Buscar follow-ups...">
      </div>
      <div class="col-md-3">
        <select class="form-select" id="followUpTypeFilter">
          <option value="">Todos os tipos</option>
          <option value="ticket_status">Status de Ticket</option>
          <option value="inactivity">Inatividade</option>
          <option value="campaign">Campanha</option>
          <option value="birthday">Aniversário</option>
        </select>
      </div>
      <div class="col-md-3">
        <select class="form-select" id="followUpStatusFilter">
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="paused">Pausado</option>
        </select>
      </div>
    </div>
    
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Delay</th>
            <th>Status</th>
            <th>Estatísticas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="followUpsTableBody">
          <tr>
            <td colspan="6" class="text-center py-4">
              <div class="spinner-border text-primary" role="status"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  // Event listeners
  document.getElementById('newFollowUpBtn')?.addEventListener('click', () => openFollowUpModal());
  document.getElementById('followUpSearch')?.addEventListener('input', debounce(() => fetchFollowUps(), 300));
  document.getElementById('followUpTypeFilter')?.addEventListener('change', () => fetchFollowUps());
  document.getElementById('followUpStatusFilter')?.addEventListener('change', () => fetchFollowUps());
  
  // Carregar dados
  fetchFollowUps();
}

async function fetchFollowUps() {
  const tbody = document.getElementById('followUpsTableBody');
  if (!tbody) return;
  
  try {
    const search = document.getElementById('followUpSearch')?.value || '';
    const type = document.getElementById('followUpTypeFilter')?.value || '';
    const status = document.getElementById('followUpStatusFilter')?.value || '';
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    
    const response = await apiFetch(`/follow-ups?${params}`);
    
    if (response.success && response.data.followUps) {
      renderFollowUpsList(response.data.followUps);
    } else {
      throw new Error(response.message || 'Erro ao carregar follow-ups');
    }
  } catch (error) {
    console.error('Erro ao buscar follow-ups:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger">
          <i class="bi bi-exclamation-triangle"></i> Erro ao carregar follow-ups: ${error.message}
        </td>
      </tr>
    `;
  }
}

function renderFollowUpsList(followUps) {
  const tbody = document.getElementById('followUpsTableBody');
  
  if (followUps.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4">
          <i class="bi bi-info-circle"></i> Nenhum follow-up encontrado
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = followUps.map(followUp => `
    <tr>
      <td>
        <strong>${followUp.name}</strong>
        <br><small class="text-muted">${followUp.description || ''}</small>
      </td>
      <td><span class="badge bg-info">${getFollowUpTypeText(followUp.type)}</span></td>
      <td>${followUp.delay} ${getDelayUnitText(followUp.delayUnit)}</td>
      <td><span class="badge ${followUp.status === 'active' ? 'bg-success' : 'bg-secondary'}">${followUp.status === 'active' ? 'Ativo' : 'Pausado'}</span></td>
      <td>
        <small>
          Enviados: <strong>${followUp.stats?.totalSent || 0}</strong><br>
          Taxa resposta: <strong>${followUp.stats?.replyRate || 0}%</strong>
        </small>
      </td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" onclick="window.viewFollowUp('${followUp.id}')">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-outline-success" onclick="window.toggleFollowUpStatus('${followUp.id}', '${followUp.status}')">
            <i class="bi bi-${followUp.status === 'active' ? 'pause' : 'play'}-circle"></i>
          </button>
          <button class="btn btn-outline-danger" onclick="window.deleteFollowUp('${followUp.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openFollowUpModal(followUpId = null) {
  showToast('Modal de follow-up em desenvolvimento', 'info');
  // TODO: Implementar modal de follow-up
}

function getFollowUpTypeText(type) {
  const types = {
    ticket_status: 'Status Ticket',
    inactivity: 'Inatividade',
    campaign: 'Campanha',
    birthday: 'Aniversário',
    abandoned_cart: 'Carrinho Abandonado',
    custom: 'Personalizado'
  };
  return types[type] || type;
}

function getDelayUnitText(unit) {
  const units = {
    minutes: 'min',
    hours: 'h',
    days: 'dias',
    weeks: 'semanas'
  };
  return units[unit] || unit;
}

// ==================== GATILHOS ====================

async function loadTriggers() {
  const container = document.getElementById('triggersContent');
  if (!container) return;
  
  container.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h3><i class="bi bi-lightning-charge"></i> Gatilhos e Ações</h3>
        <p class="text-muted mb-0">Automatize ações baseadas em eventos do sistema</p>
      </div>
      <button class="btn btn-primary" id="newTriggerBtn">
        <i class="bi bi-plus-circle"></i> Novo Gatilho
      </button>
    </div>
    
    <div class="row mb-3">
      <div class="col-md-6">
        <input type="text" class="form-control" id="triggerSearch" placeholder="Buscar gatilhos...">
      </div>
      <div class="col-md-3">
        <select class="form-select" id="triggerEventFilter">
          <option value="">Todos os eventos</option>
          <option value="message_received">Mensagem Recebida</option>
          <option value="ticket_created">Ticket Criado</option>
          <option value="ticket_status_changed">Status Alterado</option>
          <option value="tag_added">Tag Adicionada</option>
        </select>
      </div>
      <div class="col-md-3">
        <select class="form-select" id="triggerStatusFilter">
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="paused">Pausado</option>
        </select>
      </div>
    </div>
    
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Evento</th>
            <th>Ações</th>
            <th>Prioridade</th>
            <th>Status</th>
            <th>Estatísticas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="triggersTableBody">
          <tr>
            <td colspan="7" class="text-center py-4">
              <div class="spinner-border text-primary" role="status"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  
  // Event listeners
  document.getElementById('newTriggerBtn')?.addEventListener('click', () => openTriggerModal());
  document.getElementById('triggerSearch')?.addEventListener('input', debounce(() => fetchTriggers(), 300));
  document.getElementById('triggerEventFilter')?.addEventListener('change', () => fetchTriggers());
  document.getElementById('triggerStatusFilter')?.addEventListener('change', () => fetchTriggers());
  
  // Carregar dados
  fetchTriggers();
}

async function fetchTriggers() {
  const tbody = document.getElementById('triggersTableBody');
  if (!tbody) return;
  
  try {
    const search = document.getElementById('triggerSearch')?.value || '';
    const eventType = document.getElementById('triggerEventFilter')?.value || '';
    const status = document.getElementById('triggerStatusFilter')?.value || '';
    
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (eventType) params.append('eventType', eventType);
    if (status) params.append('status', status);
    
    const response = await apiFetch(`/triggers?${params}`);
    
    if (response.success && response.data.triggers) {
      renderTriggersList(response.data.triggers);
    } else {
      throw new Error(response.message || 'Erro ao carregar gatilhos');
    }
  } catch (error) {
    console.error('Erro ao buscar gatilhos:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger">
          <i class="bi bi-exclamation-triangle"></i> Erro ao carregar gatilhos: ${error.message}
        </td>
      </tr>
    `;
  }
}

function renderTriggersList(triggers) {
  const tbody = document.getElementById('triggersTableBody');
  
  if (triggers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4">
          <i class="bi bi-info-circle"></i> Nenhum gatilho encontrado
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = triggers.map(trigger => `
    <tr>
      <td>
        <strong>${trigger.name}</strong>
        <br><small class="text-muted">${trigger.description || ''}</small>
      </td>
      <td><span class="badge bg-primary">${getTriggerEventText(trigger.eventType)}</span></td>
      <td><small>${trigger.actions?.length || 0} ação(ões)</small></td>
      <td><span class="badge bg-secondary">${trigger.priority}</span></td>
      <td><span class="badge ${trigger.status === 'active' ? 'bg-success' : 'bg-secondary'}">${trigger.status === 'active' ? 'Ativo' : 'Pausado'}</span></td>
      <td>
        <small>
          Disparado: <strong>${trigger.stats?.totalTriggered || 0}</strong><br>
          Taxa sucesso: <strong>${trigger.stats?.successRate || 0}%</strong>
        </small>
      </td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" onclick="window.viewTrigger('${trigger.id}')">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-outline-success" onclick="window.toggleTriggerStatus('${trigger.id}', '${trigger.status}')">
            <i class="bi bi-${trigger.status === 'active' ? 'pause' : 'play'}-circle"></i>
          </button>
          <button class="btn btn-outline-danger" onclick="window.deleteTrigger('${trigger.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openTriggerModal(triggerId = null) {
  showToast('Modal de gatilho em desenvolvimento', 'info');
  // TODO: Implementar modal de gatilho
}

function getTriggerEventText(eventType) {
  const events = {
    message_received: 'Mensagem Recebida',
    message_sent: 'Mensagem Enviada',
    ticket_created: 'Ticket Criado',
    ticket_status_changed: 'Status Alterado',
    ticket_assigned: 'Ticket Atribuído',
    ticket_closed: 'Ticket Fechado',
    contact_created: 'Contato Criado',
    tag_added: 'Tag Adicionada',
    tag_removed: 'Tag Removida',
    campaign_sent: 'Campanha Enviada',
    nps_received: 'NPS Recebido'
  };
  return events[eventType] || eventType;
}

// ==================== FUNÇÕES GLOBAIS ====================

// Expor funções globalmente para uso nos botões inline
window.viewFlow = async (id) => { showToast('Visualizar fluxo: ' + id, 'info'); };
window.toggleFlowStatus = async (id, currentStatus) => { showToast('Alterando status do fluxo...', 'info'); };
window.duplicateFlow = async (id) => { showToast('Duplicando fluxo...', 'info'); };
window.deleteFlow = async (id) => { if (confirm('Deseja realmente deletar este fluxo?')) showToast('Deletando fluxo...', 'info'); };

window.viewFollowUp = async (id) => { showToast('Visualizar follow-up: ' + id, 'info'); };
window.toggleFollowUpStatus = async (id, currentStatus) => { showToast('Alterando status do follow-up...', 'info'); };
window.deleteFollowUp = async (id) => { if (confirm('Deseja realmente deletar este follow-up?')) showToast('Deletando follow-up...', 'info'); };

window.viewTrigger = async (id) => { showToast('Visualizar gatilho: ' + id, 'info'); };
window.toggleTriggerStatus = async (id, currentStatus) => { showToast('Alterando status do gatilho...', 'info'); };
window.deleteTrigger = async (id) => { if (confirm('Deseja realmente deletar este gatilho?')) showToast('Deletando gatilho...', 'info'); };

// ==================== UTILITÁRIOS ====================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

