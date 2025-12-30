/**
 * WEBHOOKS VIEW - Interface de Gerenciamento de Webhooks
 * Listagem, Criação, Edição, Logs e Estatísticas
 */

import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';

let currentWebhookId = null;
let availableEvents = {};

/**
 * Inicializa a view de webhooks
 */
export async function initWebhooksView() {
  console.log('🔌 Inicializando Webhooks View...');
  
  // Carregar eventos disponíveis
  await loadAvailableEvents();
  
  // Carregar webhooks
  await loadWebhooks();
  
  // Event Listeners
  setupEventListeners();
  
  console.log('✅ Webhooks View inicializado');
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
  // Botões principais
  document.getElementById('createWebhookBtn')?.addEventListener('click', openCreateModal);
  document.getElementById('saveWebhookBtn')?.addEventListener('click', saveWebhook);
  
  // Filtros
  document.getElementById('webhookStatusFilter')?.addEventListener('change', loadWebhooks);
  document.getElementById('webhookEventFilter')?.addEventListener('change', loadWebhooks);
  
  // Search
  document.getElementById('webhookSearchInput')?.addEventListener('input', filterWebhooks);
}

/**
 * Carrega eventos disponíveis
 */
async function loadAvailableEvents() {
  try {
    const response = await apiFetch('/webhooks/events');
    availableEvents = response.data || {};
    
    // Preencher filtro de eventos
    const eventFilter = document.getElementById('webhookEventFilter');
    if (eventFilter) {
      const allEvents = availableEvents.all || [];
      eventFilter.innerHTML = '<option value="">Todos os eventos</option>';
      allEvents.forEach(event => {
        eventFilter.innerHTML += `<option value="${event}">${event}</option>`;
      });
    }
  } catch (error) {
    console.error('Erro ao carregar eventos:', error);
  }
}

/**
 * Carrega lista de webhooks
 */
async function loadWebhooks() {
  try {
    showLoading();
    
    const statusFilter = document.getElementById('webhookStatusFilter')?.value;
    const eventFilter = document.getElementById('webhookEventFilter')?.value;
    
    const params = {};
    if (statusFilter) params.isActive = statusFilter;
    if (eventFilter) params.event = eventFilter;
    
    const response = await apiFetch('/webhooks', { params });
    const webhooks = response.data || [];
    
    renderWebhooksList(webhooks);
    
    // Atualizar estatísticas
    await loadGlobalStats();
    
  } catch (error) {
    console.error('Erro ao carregar webhooks:', error);
    showToast('Erro ao carregar webhooks', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Renderiza lista de webhooks
 */
function renderWebhooksList(webhooks) {
  const tbody = document.getElementById('webhooksTableBody');
  
  if (!tbody) return;
  
  if (webhooks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted py-4">
          <i class="bi bi-webhook fs-1 d-block mb-2"></i>
          Nenhum webhook configurado
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = webhooks.map(webhook => {
    const stats = webhook.stats || {};
    const statusClass = webhook.isActive ? 'success' : 'secondary';
    const healthClass = stats.isHealthy ? 'success' : 'warning';
    
    return `
      <tr data-webhook-id="${webhook.id}">
        <td>
          <div class="d-flex align-items-center">
            <i class="bi bi-webhook text-primary me-2"></i>
            <div>
              <strong>${webhook.name}</strong>
              <br>
              <small class="text-muted">${webhook.url}</small>
            </div>
          </div>
        </td>
        <td>
          <span class="badge bg-${statusClass}">
            ${webhook.isActive ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td>
          <span class="badge bg-info">${webhook.method}</span>
        </td>
        <td>
          <small>${webhook.events.length} evento(s)</small>
        </td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-check-circle text-${healthClass}"></i>
            <small>
              ${stats.successCount || 0} / ${stats.total || 0}
              <br>
              <span class="text-muted">${stats.successRate || '0%'}</span>
            </small>
          </div>
        </td>
        <td>
          <small class="text-muted">
            ${webhook.lastTriggered ? new Date(webhook.lastTriggered).toLocaleString('pt-BR') : 'Nunca'}
          </small>
        </td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="window.viewWebhookDetails('${webhook.id}')" title="Ver detalhes">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-outline-info" onclick="window.testWebhook('${webhook.id}')" title="Testar">
              <i class="bi bi-play-circle"></i>
            </button>
            <button class="btn btn-outline-secondary" onclick="window.editWebhook('${webhook.id}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="window.deleteWebhook('${webhook.id}')" title="Deletar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Abre modal de criação
 */
function openCreateModal() {
  currentWebhookId = null;
  
  // Limpar formulário
  document.getElementById('webhookId').value = '';
  document.getElementById('webhookName').value = '';
  document.getElementById('webhookDescription').value = '';
  document.getElementById('webhookUrl').value = '';
  document.getElementById('webhookMethod').value = 'POST';
  document.getElementById('webhookSecret').value = '';
  document.getElementById('webhookRetryAttempts').value = '3';
  document.getElementById('webhookRetryDelay').value = '60';
  document.getElementById('webhookTimeout').value = '30';
  document.getElementById('webhookIsActive').checked = true;
  
  // Limpar eventos selecionados
  document.querySelectorAll('input[name="webhookEvents"]').forEach(cb => {
    cb.checked = false;
  });
  
  // Renderizar seletor de eventos
  renderEventSelector();
  
  // Mudar título
  document.querySelector('#webhookModal .modal-title').textContent = 'Criar Webhook';
  
  // Abrir modal
  const modal = new bootstrap.Modal(document.getElementById('webhookModal'));
  modal.show();
}

/**
 * Renderiza seletor de eventos
 */
function renderEventSelector() {
  const container = document.getElementById('webhookEventsContainer');
  if (!container) return;
  
  const categories = availableEvents.byCategory || {};
  
  container.innerHTML = Object.entries(categories).map(([category, events]) => {
    if (!events || events.length === 0) return '';
    
    const categoryName = {
      ticket: 'Tickets',
      message: 'Mensagens',
      contact: 'Contatos',
      user: 'Usuários',
      campaign: 'Campanhas',
      flow: 'Fluxos',
      nps: 'NPS',
      system: 'Sistema'
    }[category] || category;
    
    return `
      <div class="mb-3">
        <h6 class="text-primary">${categoryName}</h6>
        <div class="row">
          ${events.map(event => `
            <div class="col-md-6">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="webhookEvents" value="${event}" id="event-${event}">
                <label class="form-check-label" for="event-${event}">
                  <small>${event}</small>
                </label>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Edita webhook
 */
window.editWebhook = async function(webhookId) {
  try {
    showLoading();
    
    const response = await apiFetch(`/api/webhooks/${webhookId}`);
    const webhook = response.data;
    
    currentWebhookId = webhookId;
    
    // Preencher formulário
    document.getElementById('webhookId').value = webhook.id;
    document.getElementById('webhookName').value = webhook.name;
    document.getElementById('webhookDescription').value = webhook.description || '';
    document.getElementById('webhookUrl').value = webhook.url;
    document.getElementById('webhookMethod').value = webhook.method;
    document.getElementById('webhookSecret').value = webhook.secret || '';
    document.getElementById('webhookRetryAttempts').value = webhook.retryAttempts;
    document.getElementById('webhookRetryDelay').value = webhook.retryDelay;
    document.getElementById('webhookTimeout').value = webhook.timeout;
    document.getElementById('webhookIsActive').checked = webhook.isActive;
    
    // Renderizar eventos
    renderEventSelector();
    
    // Marcar eventos selecionados
    webhook.events.forEach(event => {
      const checkbox = document.getElementById(`event-${event}`);
      if (checkbox) checkbox.checked = true;
    });
    
    // Mudar título
    document.querySelector('#webhookModal .modal-title').textContent = 'Editar Webhook';
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('webhookModal'));
    modal.show();
    
  } catch (error) {
    console.error('Erro ao carregar webhook:', error);
    showToast('Erro ao carregar webhook', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Salva webhook (criar ou atualizar)
 */
async function saveWebhook() {
  try {
    // Validar
    const name = document.getElementById('webhookName').value.trim();
    const url = document.getElementById('webhookUrl').value.trim();
    
    if (!name) {
      showToast('Nome é obrigatório', 'warning');
      return;
    }
    
    if (!url) {
      showToast('URL é obrigatória', 'warning');
      return;
    }
    
    // Coletar eventos selecionados
    const events = Array.from(document.querySelectorAll('input[name="webhookEvents"]:checked'))
      .map(cb => cb.value);
    
    if (events.length === 0) {
      showToast('Selecione pelo menos um evento', 'warning');
      return;
    }
    
    showLoading();
    
    const data = {
      name,
      description: document.getElementById('webhookDescription').value.trim(),
      url,
      method: document.getElementById('webhookMethod').value,
      secret: document.getElementById('webhookSecret').value.trim() || undefined,
      events,
      retryAttempts: parseInt(document.getElementById('webhookRetryAttempts').value),
      retryDelay: parseInt(document.getElementById('webhookRetryDelay').value),
      timeout: parseInt(document.getElementById('webhookTimeout').value),
      isActive: document.getElementById('webhookIsActive').checked
    };
    
    if (currentWebhookId) {
      // Atualizar
      await apiFetch(`/api/webhooks/${currentWebhookId}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      showToast('Webhook atualizado com sucesso!', 'success');
    } else {
      // Criar
      await apiFetch('/webhooks', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      showToast('Webhook criado com sucesso!', 'success');
    }
    
    // Fechar modal
    bootstrap.Modal.getInstance(document.getElementById('webhookModal')).hide();
    
    // Recarregar lista
    await loadWebhooks();
    
  } catch (error) {
    console.error('Erro ao salvar webhook:', error);
    showToast('Erro ao salvar webhook: ' + (error.message || 'Erro desconhecido'), 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Deleta webhook
 */
window.deleteWebhook = async function(webhookId) {
  if (!confirm('Tem certeza que deseja deletar este webhook?')) {
    return;
  }
  
  try {
    showLoading();
    
    await apiFetch(`/api/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
    
    showToast('Webhook deletado com sucesso!', 'success');
    await loadWebhooks();
    
  } catch (error) {
    console.error('Erro ao deletar webhook:', error);
    showToast('Erro ao deletar webhook', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Testa webhook
 */
window.testWebhook = async function(webhookId) {
  try {
    showLoading();
    
    const response = await apiFetch(`/api/webhooks/${webhookId}/test`, {
      method: 'POST'
    });
    
    const result = response.data;
    
    if (result.success) {
      showToast(`✅ Teste bem-sucedido! Status: ${result.responseStatus} (${result.responseTime}ms)`, 'success');
    } else {
      showToast(`❌ Teste falhou: ${result.error}`, 'error');
    }
    
  } catch (error) {
    console.error('Erro ao testar webhook:', error);
    showToast('Erro ao testar webhook', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Visualiza detalhes do webhook
 */
window.viewWebhookDetails = async function(webhookId) {
  try {
    showLoading();
    
    const [webhookResponse, logsResponse, statsResponse] = await Promise.all([
      apiFetch(`/api/webhooks/${webhookId}`),
      apiFetch(`/api/webhooks/${webhookId}/logs?limit=10`),
      apiFetch(`/api/webhooks/${webhookId}/stats`)
    ]);
    
    const webhook = webhookResponse.data;
    const logs = logsResponse.data.logs || [];
    const stats = statsResponse.data;
    
    renderWebhookDetails(webhook, logs, stats);
    
    // Abrir modal
    const modal = new bootstrap.Modal(document.getElementById('webhookDetailsModal'));
    modal.show();
    
  } catch (error) {
    console.error('Erro ao carregar detalhes:', error);
    showToast('Erro ao carregar detalhes do webhook', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Renderiza detalhes do webhook
 */
function renderWebhookDetails(webhook, logs, stats) {
  // Informações básicas
  document.getElementById('detailsWebhookName').textContent = webhook.name;
  document.getElementById('detailsWebhookUrl').textContent = webhook.url;
  document.getElementById('detailsWebhookMethod').textContent = webhook.method;
  document.getElementById('detailsWebhookStatus').innerHTML = `
    <span class="badge bg-${webhook.isActive ? 'success' : 'secondary'}">
      ${webhook.isActive ? 'Ativo' : 'Inativo'}
    </span>
  `;
  
  // Eventos
  document.getElementById('detailsWebhookEvents').innerHTML = webhook.events.map(event => 
    `<span class="badge bg-info me-1">${event}</span>`
  ).join('');
  
  // Estatísticas
  const webhookStats = stats.webhook || {};
  const logStats = stats.logs || {};
  
  document.getElementById('detailsSuccessCount').textContent = webhookStats.successCount || 0;
  document.getElementById('detailsFailureCount').textContent = webhookStats.failureCount || 0;
  document.getElementById('detailsSuccessRate').textContent = webhookStats.successRate || '0%';
  document.getElementById('detailsAvgResponseTime').textContent = logStats.avgResponseTime || '0ms';
  
  // Último disparo
  document.getElementById('detailsLastTriggered').textContent = webhook.lastTriggered
    ? new Date(webhook.lastTriggered).toLocaleString('pt-BR')
    : 'Nunca';
  
  document.getElementById('detailsLastStatus').innerHTML = `
    <span class="badge bg-${webhook.lastStatus === 'success' ? 'success' : 'danger'}">
      ${webhook.lastStatus || 'N/A'}
    </span>
  `;
  
  // Logs recentes
  renderRecentLogs(logs);
}

/**
 * Renderiza logs recentes
 */
function renderRecentLogs(logs) {
  const container = document.getElementById('detailsRecentLogs');
  
  if (logs.length === 0) {
    container.innerHTML = '<p class="text-muted">Nenhum log disponível</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Status</th>
            <th>Tempo</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td><small>${log.event}</small></td>
              <td>
                <span class="badge bg-${log.status === 'success' ? 'success' : 'danger'}">
                  ${log.status}
                </span>
              </td>
              <td><small>${log.responseTime ? log.responseTime + 'ms' : 'N/A'}</small></td>
              <td><small>${new Date(log.createdAt).toLocaleString('pt-BR')}</small></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Carrega estatísticas globais
 */
async function loadGlobalStats() {
  try {
    const response = await apiFetch('/webhooks/stats/global');
    const stats = response.data || {};
    
    // Atualizar cards
    document.getElementById('totalWebhooks').textContent = stats.webhooks?.total || 0;
    document.getElementById('activeWebhooks').textContent = stats.webhooks?.active || 0;
    document.getElementById('totalWebhookCalls').textContent = stats.webhooks?.totalCalls || 0;
    document.getElementById('globalSuccessRate').textContent = stats.webhooks?.successRate || '0%';
    
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

/**
 * Filtra webhooks por texto
 */
function filterWebhooks() {
  const searchText = document.getElementById('webhookSearchInput')?.value.toLowerCase() || '';
  const rows = document.querySelectorAll('#webhooksTableBody tr');
  
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(searchText) ? '' : 'none';
  });
}

/**
 * Exporta função de inicialização
 */
export default initWebhooksView;

