import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';
import { escapeHtml } from '../ui/dom.js';

/**
 * View de Filas de Atendimento
 */

let queueModal = null;

/**
 * Renderizar lista de filas
 */
export async function renderQueues() {
  const container = document.getElementById('queuesContent');
  if (!container) return;

  showLoading();

  try {
    const response = await apiFetch('/queues');
    const queues = Array.isArray(response) ? response : (response.data || response.queues || []);
    const agents = await apiFetch('/users').catch(() => []);

    container.innerHTML = `
      <div class="row g-3 mb-4">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <button class="btn btn-primary" id="newQueueBtn">
                <i class="bi bi-plus-lg"></i> Nova Fila
              </button>
              <button class="btn btn-outline-secondary ms-2" id="initDefaultsBtn">
                <i class="bi bi-arrow-clockwise"></i> Inicializar Padrões
              </button>
            </div>
            <div class="text-muted">
              <i class="bi bi-info-circle"></i> ${queues.length} fila(s) configurada(s)
            </div>
          </div>
        </div>
      </div>

      <!-- Grid de Filas -->
      <div class="row g-3">
        ${Array.isArray(queues) ? queues.map(queue => renderQueueCard(queue)).join('') : ''}
      </div>
    `;

    // Event listeners
    setupEventListeners();
    loadQueueStats(queues);

  } catch (error) {
    showToast('Erro ao carregar filas', 'error');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Renderizar card de fila
 */
function renderQueueCard(queue) {
  const distributionModes = {
    'round_robin': 'Round Robin',
    'least_active': 'Menos Ativo',
    'manual': 'Manual',
    'random': 'Aleatório',
    'priority': 'Prioridade'
  };

  return `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100 queue-card" style="border-left: 4px solid ${escapeHtml(queue.color)}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div class="d-flex align-items-center">
              ${queue.icon ? `<i class="bi bi-${escapeHtml(queue.icon)} me-2" style="font-size: 1.5rem; color: ${escapeHtml(queue.color)}"></i>` : ''}
              <div>
                <h5 class="card-title mb-0">${escapeHtml(queue.name)}</h5>
                <small class="text-muted">${escapeHtml(queue.slug)}</small>
              </div>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="window.editQueue('${queue.id}')" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-info" onclick="window.viewQueueStats('${queue.id}')" title="Estatísticas">
                <i class="bi bi-graph-up"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="window.deleteQueue('${queue.id}')" title="Excluir">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

          ${queue.description ? `<p class="card-text text-muted small">${escapeHtml(queue.description)}</p>` : ''}

          <!-- Estatísticas -->
          <div class="row g-2 mb-3" id="queue-stats-${queue.id}">
            <div class="col-6">
              <div class="text-center p-2 bg-light rounded">
                <div class="h5 mb-0 text-warning" id="waiting-${queue.id}">-</div>
                <small class="text-muted">Aguardando</small>
              </div>
            </div>
            <div class="col-6">
              <div class="text-center p-2 bg-light rounded">
                <div class="h5 mb-0 text-primary" id="active-${queue.id}">-</div>
                <small class="text-muted">Ativos</small>
              </div>
            </div>
          </div>

          <!-- Configurações -->
          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small class="text-muted"><i class="bi bi-diagram-3"></i> Distribuição:</small>
              <span class="badge bg-secondary">${distributionModes[queue.distributionMode]}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small class="text-muted"><i class="bi bi-people"></i> Agentes:</small>
              <span class="badge bg-info">${queue.agents?.length || 0}</span>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
              <small class="text-muted"><i class="bi bi-ticket"></i> Máx por agente:</small>
              <span class="badge bg-dark">${queue.maxTicketsPerAgent}</span>
            </div>
          </div>

          <!-- Badges -->
          <div class="d-flex flex-wrap gap-2">
            ${queue.isDefault ? '<span class="badge bg-primary">Padrão</span>' : ''}
            ${queue.autoAssign ? '<span class="badge bg-success">Auto-atribuir</span>' : ''}
            ${queue.chatbotEnabled ? '<span class="badge bg-info">Chatbot</span>' : ''}
            ${!queue.isActive ? '<span class="badge bg-danger">Inativa</span>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Carregar estatísticas das filas
 */
async function loadQueueStats(queues) {
  for (const queue of queues) {
    try {
      const stats = await apiFetch(`/queues/${queue.id}/stats`);
      
      const waitingEl = document.getElementById(`waiting-${queue.id}`);
      const activeEl = document.getElementById(`active-${queue.id}`);
      
      if (waitingEl) waitingEl.textContent = stats.waiting || 0;
      if (activeEl) activeEl.textContent = stats.active || 0;
    } catch (error) {
      console.error(`Erro ao carregar stats da fila ${queue.id}:`, error);
    }
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('newQueueBtn')?.addEventListener('click', () => openQueueModal());
  document.getElementById('initDefaultsBtn')?.addEventListener('click', initDefaults);
}

/**
 * Abrir modal de fila
 */
function openQueueModal(queueId = null) {
  const modal = document.getElementById('queueModal');
  if (!modal) return;

  const title = document.getElementById('queueModalTitle');
  const form = document.getElementById('queueForm');

  if (queueId) {
    title.textContent = 'Editar Fila';
    loadQueueData(queueId);
  } else {
    title.textContent = 'Nova Fila';
    form.reset();
    document.getElementById('queueId').value = '';
    updateColorPreview();
  }

  queueModal = new bootstrap.Modal(modal);
  queueModal.show();
}

/**
 * Carregar dados da fila
 */
async function loadQueueData(queueId) {
  try {
    const queue = await apiFetch(`/queues/${queueId}`);

    document.getElementById('queueId').value = queue.id;
    document.getElementById('queueName').value = queue.name || '';
    document.getElementById('queueSlug').value = queue.slug || '';
    document.getElementById('queueColor').value = queue.color || '#007bff';
    document.getElementById('queueIcon').value = queue.icon || '';
    document.getElementById('queueDescription').value = queue.description || '';
    document.getElementById('queueDistributionMode').value = queue.distributionMode || 'round_robin';
    document.getElementById('queueMaxTickets').value = queue.maxTicketsPerAgent || 10;
    document.getElementById('queueAutoAssign').checked = queue.autoAssign !== false;
    document.getElementById('queueChatbotEnabled').checked = queue.chatbotEnabled || false;
    document.getElementById('queueGreeting').value = queue.greetingMessage || '';
    document.getElementById('queueOutOfHours').value = queue.outOfHoursMessage || '';
    document.getElementById('queueSlaTime').value = queue.slaTime || 3600;
    document.getElementById('queueIsDefault').checked = queue.isDefault || false;
    document.getElementById('queueIsActive').checked = queue.isActive !== false;

    updateColorPreview();
  } catch (error) {
    showToast('Erro ao carregar dados da fila', 'error');
  }
}

/**
 * Atualizar preview de cor
 */
function updateColorPreview() {
  const colorInput = document.getElementById('queueColor');
  const preview = document.getElementById('queueColorPreview');
  if (colorInput && preview) {
    preview.style.backgroundColor = colorInput.value;
  }
}

/**
 * Salvar fila
 */
window.saveQueue = async function() {
  const form = document.getElementById('queueForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const queueId = document.getElementById('queueId').value;
  const data = {
    name: document.getElementById('queueName').value,
    slug: document.getElementById('queueSlug').value || undefined,
    color: document.getElementById('queueColor').value,
    icon: document.getElementById('queueIcon').value || null,
    description: document.getElementById('queueDescription').value || null,
    distributionMode: document.getElementById('queueDistributionMode').value,
    maxTicketsPerAgent: parseInt(document.getElementById('queueMaxTickets').value),
    autoAssign: document.getElementById('queueAutoAssign').checked,
    chatbotEnabled: document.getElementById('queueChatbotEnabled').checked,
    greetingMessage: document.getElementById('queueGreeting').value || null,
    outOfHoursMessage: document.getElementById('queueOutOfHours').value || null,
    slaTime: parseInt(document.getElementById('queueSlaTime').value),
    isDefault: document.getElementById('queueIsDefault').checked,
    isActive: document.getElementById('queueIsActive').checked
  };

  try {
    if (queueId) {
      await apiFetch(`/queues/${queueId}`, { method: 'PUT', body: data });
      showToast('Fila atualizada com sucesso!', 'success');
    } else {
      await apiFetch('/queues', { method: 'POST', body: data });
      showToast('Fila criada com sucesso!', 'success');
    }

    queueModal.hide();
    renderQueues();
  } catch (error) {
    showToast(error.message || 'Erro ao salvar fila', 'error');
  }
};

/**
 * Editar fila
 */
window.editQueue = function(queueId) {
  openQueueModal(queueId);
};

/**
 * Ver estatísticas da fila
 */
window.viewQueueStats = async function(queueId) {
  try {
    const stats = await apiFetch(`/queues/${queueId}/stats`);
    const queue = await apiFetch(`/queues/${queueId}`);

    const message = `
      <h5>${escapeHtml(queue.name)}</h5>
      <hr>
      <div class="row g-3">
        <div class="col-6">
          <div class="text-center">
            <div class="h3 text-warning">${stats.waiting}</div>
            <small>Aguardando</small>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h3 text-primary">${stats.active}</div>
            <small>Ativos</small>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h3 text-success">${stats.resolved}</div>
            <small>Resolvidos</small>
          </div>
        </div>
        <div class="col-6">
          <div class="text-center">
            <div class="h3 text-info">${stats.total}</div>
            <small>Total</small>
          </div>
        </div>
      </div>
    `;

    // Criar modal temporário para exibir
    const tempModal = document.createElement('div');
    tempModal.innerHTML = `
      <div class="modal fade" id="statsModal" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Estatísticas da Fila</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">${message}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(tempModal);
    const modal = new bootstrap.Modal(document.getElementById('statsModal'));
    modal.show();
    
    // Remover ao fechar
    document.getElementById('statsModal').addEventListener('hidden.bs.modal', () => {
      tempModal.remove();
    });
  } catch (error) {
    showToast('Erro ao carregar estatísticas', 'error');
  }
};

/**
 * Excluir fila
 */
window.deleteQueue = async function(queueId) {
  if (!confirm('Deseja realmente excluir esta fila? Esta ação não pode ser desfeita.')) return;

  try {
    await apiFetch(`/queues/${queueId}`, { method: 'DELETE' });
    showToast('Fila excluída com sucesso!', 'success');
    renderQueues();
  } catch (error) {
    showToast(error.message || 'Erro ao excluir fila', 'error');
  }
};

/**
 * Inicializar filas padrões
 */
async function initDefaults() {
  if (!confirm('Deseja criar as filas padrões do sistema?')) return;

  try {
    const result = await apiFetch('/queues/init-defaults', { method: 'POST' });
    showToast(result.message, 'success');
    renderQueues();
  } catch (error) {
    showToast('Erro ao inicializar filas padrões', 'error');
  }
}

// Event listener para atualizar preview de cor
document.addEventListener('DOMContentLoaded', () => {
  const colorInput = document.getElementById('queueColor');
  if (colorInput) {
    colorInput.addEventListener('input', updateColorPreview);
  }
});

