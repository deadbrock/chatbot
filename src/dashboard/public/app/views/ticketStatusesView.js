import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';
import { escapeHtml } from '../ui/dom.js';

/**
 * View de Status Personalizados
 */

let statusModal = null;

/**
 * Renderizar lista de status
 */
export async function renderTicketStatuses() {
  const container = document.getElementById('ticketStatusesContent');
  if (!container) return;

  showLoading();

  try {
    const response = await apiFetch('/ticket-statuses');
    const statuses = Array.isArray(response) ? response : (response.data || response.statuses || []);
    const stats = await apiFetch('/ticket-statuses/stats').catch(() => []);

    container.innerHTML = `
      <div class="row g-3 mb-4">
        <div class="col-12">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <button class="btn btn-primary" id="newStatusBtn">
                <i class="bi bi-plus-lg"></i> Novo Status
              </button>
              <button class="btn btn-outline-secondary ms-2" id="initDefaultsBtn">
                <i class="bi bi-arrow-clockwise"></i> Inicializar Padrões
              </button>
            </div>
            <div class="text-muted">
              <i class="bi bi-info-circle"></i> Arraste para reordenar
            </div>
          </div>
        </div>
      </div>

      <!-- Grid de Status -->
      <div class="row g-3" id="statusGrid">
        ${Array.isArray(statuses) ? statuses.map(status => renderStatusCard(status, stats)).join('') : ''}
      </div>
    `;

    // Event listeners
    setupEventListeners();
    initDragAndDrop();

  } catch (error) {
    showToast('Erro ao carregar status', 'error');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Renderizar card de status
 */
function renderStatusCard(status, stats) {
  const stat = stats.find(s => s.status === status.slug);
  const count = stat ? stat.count : 0;

  return `
    <div class="col-md-6 col-lg-4" data-status-id="${status.id}" draggable="true">
      <div class="card h-100 status-card" style="border-left: 4px solid ${escapeHtml(status.color)}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="d-flex align-items-center">
              ${status.icon ? `<i class="bi bi-${escapeHtml(status.icon)} me-2" style="font-size: 1.5rem; color: ${escapeHtml(status.color)}"></i>` : ''}
              <div>
                <h5 class="card-title mb-0">${escapeHtml(status.name)}</h5>
                <small class="text-muted">${escapeHtml(status.slug)}</small>
              </div>
            </div>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="window.editStatus('${status.id}')" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="window.deleteStatus('${status.id}')" title="Excluir">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>

          ${status.description ? `<p class="card-text text-muted small">${escapeHtml(status.description)}</p>` : ''}

          <div class="d-flex flex-wrap gap-2 mt-3">
            <span class="badge" style="background-color: ${escapeHtml(status.color)}">${escapeHtml(status.category)}</span>
            ${status.isDefault ? '<span class="badge bg-primary">Padrão</span>' : ''}
            ${status.isFinal ? '<span class="badge bg-secondary">Final</span>' : ''}
            ${!status.isActive ? '<span class="badge bg-danger">Inativo</span>' : ''}
          </div>

          <div class="mt-3 pt-3 border-top">
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">
                <i class="bi bi-ticket"></i> ${count} ticket(s)
              </small>
              <i class="bi bi-grip-vertical text-muted" style="cursor: move"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('newStatusBtn')?.addEventListener('click', () => openStatusModal());
  document.getElementById('initDefaultsBtn')?.addEventListener('click', initDefaults);
}

/**
 * Inicializar drag and drop
 */
function initDragAndDrop() {
  const grid = document.getElementById('statusGrid');
  if (!grid) return;

  let draggedElement = null;

  grid.querySelectorAll('[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedElement = item;
      item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      saveOrder();
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(grid, e.clientY);
      if (afterElement == null) {
        grid.appendChild(draggedElement);
      } else {
        grid.insertBefore(draggedElement, afterElement);
      }
    });
  });
}

/**
 * Obter elemento após o cursor
 */
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('[draggable="true"]:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Salvar ordem
 */
async function saveOrder() {
  const grid = document.getElementById('statusGrid');
  if (!grid) return;

  const statusIds = [...grid.querySelectorAll('[data-status-id]')].map(el => el.dataset.statusId);

  try {
    await apiFetch('/ticket-statuses/reorder', {
      method: 'POST',
      body: JSON.stringify({ statusIds })
    });
    showToast('Ordem atualizada!', 'success');
  } catch (error) {
    showToast('Erro ao atualizar ordem', 'error');
  }
}

/**
 * Abrir modal de status
 */
function openStatusModal(statusId = null) {
  const modal = document.getElementById('statusModal');
  if (!modal) return;

  const title = document.getElementById('statusModalTitle');
  const form = document.getElementById('statusForm');

  if (statusId) {
    title.textContent = 'Editar Status';
    loadStatusData(statusId);
  } else {
    title.textContent = 'Novo Status';
    form.reset();
    document.getElementById('statusId').value = '';
    updateColorPreview();
  }

  statusModal = new bootstrap.Modal(modal);
  statusModal.show();
}

/**
 * Carregar dados do status
 */
async function loadStatusData(statusId) {
  try {
    const status = await apiFetch(`/ticket-statuses/${statusId}`);

    document.getElementById('statusId').value = status.id;
    document.getElementById('statusName').value = status.name || '';
    document.getElementById('statusSlug').value = status.slug || '';
    document.getElementById('statusColor').value = status.color || '#6c757d';
    document.getElementById('statusIcon').value = status.icon || '';
    document.getElementById('statusCategory').value = status.category || 'custom';
    document.getElementById('statusDescription').value = status.description || '';
    document.getElementById('statusIsDefault').checked = status.isDefault || false;
    document.getElementById('statusIsFinal').checked = status.isFinal || false;
    document.getElementById('statusIsActive').checked = status.isActive !== false;

    updateColorPreview();
  } catch (error) {
    showToast('Erro ao carregar dados do status', 'error');
  }
}

/**
 * Atualizar preview de cor
 */
function updateColorPreview() {
  const colorInput = document.getElementById('statusColor');
  const preview = document.getElementById('colorPreview');
  if (colorInput && preview) {
    preview.style.backgroundColor = colorInput.value;
  }
}

/**
 * Salvar status
 */
window.saveStatus = async function() {
  const form = document.getElementById('statusForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const statusId = document.getElementById('statusId').value;
  const data = {
    name: document.getElementById('statusName').value,
    slug: document.getElementById('statusSlug').value || undefined,
    color: document.getElementById('statusColor').value,
    icon: document.getElementById('statusIcon').value || null,
    category: document.getElementById('statusCategory').value,
    description: document.getElementById('statusDescription').value || null,
    isDefault: document.getElementById('statusIsDefault').checked,
    isFinal: document.getElementById('statusIsFinal').checked,
    isActive: document.getElementById('statusIsActive').checked
  };

  try {
    if (statusId) {
      await apiFetch(`/ticket-statuses/${statusId}`, { method: 'PUT', body: data });
      showToast('Status atualizado com sucesso!', 'success');
    } else {
      await apiFetch('/ticket-statuses', { method: 'POST', body: data });
      showToast('Status criado com sucesso!', 'success');
    }

    statusModal.hide();
    renderTicketStatuses();
  } catch (error) {
    showToast(error.message || 'Erro ao salvar status', 'error');
  }
};

/**
 * Editar status
 */
window.editStatus = function(statusId) {
  openStatusModal(statusId);
};

/**
 * Excluir status
 */
window.deleteStatus = async function(statusId) {
  if (!confirm('Deseja realmente excluir este status? Esta ação não pode ser desfeita.')) return;

  try {
    await apiFetch(`/ticket-statuses/${statusId}`, { method: 'DELETE' });
    showToast('Status excluído com sucesso!', 'success');
    renderTicketStatuses();
  } catch (error) {
    showToast(error.message || 'Erro ao excluir status', 'error');
  }
};

/**
 * Inicializar status padrões
 */
async function initDefaults() {
  if (!confirm('Deseja criar os status padrões do sistema?')) return;

  try {
    const result = await apiFetch('/ticket-statuses/init-defaults', { method: 'POST' });
    showToast(result.message, 'success');
    renderTicketStatuses();
  } catch (error) {
    showToast('Erro ao inicializar status padrões', 'error');
  }
}

// Event listener para atualizar preview de cor
document.addEventListener('DOMContentLoaded', () => {
  const colorInput = document.getElementById('statusColor');
  if (colorInput) {
    colorInput.addEventListener('input', updateColorPreview);
  }
});

