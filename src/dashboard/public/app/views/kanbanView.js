import { apiFetch } from '../api.js';
import { createToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';

/**
 * View Kanban para Tickets
 * Visualização em quadro com drag-and-drop
 */

export async function renderKanban({ apiFetch, createToast, escapeHtml }) {
  const kanbanContent = document.getElementById('kanbanContent');
  if (!kanbanContent) return;

  kanbanContent.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2>Kanban de Tickets</h2>
        <p class="text-muted">Arraste os tickets entre as colunas para mudar o status</p>
      </div>
      <div class="d-flex gap-2">
        <select class="form-select form-select-sm" id="kanbanDepartmentFilter">
          <option value="">Todos os Departamentos</option>
        </select>
        <select class="form-select form-select-sm" id="kanbanAgentFilter">
          <option value="">Todos os Atendentes</option>
        </select>
        <button class="btn btn-sm btn-outline-secondary" id="refreshKanban">
          <i class="bi bi-arrow-clockwise"></i> Atualizar
        </button>
      </div>
    </div>

    <div class="kanban-board" id="kanbanBoard">
      <div class="kanban-column" data-status="open">
        <div class="kanban-column-header">
          <h5><i class="bi bi-inbox"></i> Abertos</h5>
          <span class="badge bg-primary" id="countOpen">0</span>
        </div>
        <div class="kanban-column-body" id="columnOpen" data-status="open">
          <div class="kanban-loading">Carregando...</div>
        </div>
      </div>

      <div class="kanban-column" data-status="waiting_human">
        <div class="kanban-column-header">
          <h5><i class="bi bi-hourglass-split"></i> Aguardando</h5>
          <span class="badge bg-warning" id="countWaiting">0</span>
        </div>
        <div class="kanban-column-body" id="columnWaiting" data-status="waiting_human">
          <div class="kanban-loading">Carregando...</div>
        </div>
      </div>

      <div class="kanban-column" data-status="in_progress">
        <div class="kanban-column-header">
          <h5><i class="bi bi-chat-dots"></i> Em Atendimento</h5>
          <span class="badge bg-info" id="countProgress">0</span>
        </div>
        <div class="kanban-column-body" id="columnProgress" data-status="in_progress">
          <div class="kanban-loading">Carregando...</div>
        </div>
      </div>

      <div class="kanban-column" data-status="resolved">
        <div class="kanban-column-header">
          <h5><i class="bi bi-check-circle"></i> Resolvidos</h5>
          <span class="badge bg-success" id="countResolved">0</span>
        </div>
        <div class="kanban-column-body" id="columnResolved" data-status="resolved">
          <div class="kanban-loading">Carregando...</div>
        </div>
      </div>

      <div class="kanban-column" data-status="closed">
        <div class="kanban-column-header">
          <h5><i class="bi bi-x-circle"></i> Fechados</h5>
          <span class="badge bg-secondary" id="countClosed">0</span>
        </div>
        <div class="kanban-column-body" id="columnClosed" data-status="closed">
          <div class="kanban-loading">Carregando...</div>
        </div>
      </div>
    </div>
  `;

  // Carregar tickets
  await loadKanbanTickets();

  // Event listeners
  document.getElementById('refreshKanban').addEventListener('click', loadKanbanTickets);
  document.getElementById('kanbanDepartmentFilter').addEventListener('change', loadKanbanTickets);
  document.getElementById('kanbanAgentFilter').addEventListener('change', loadKanbanTickets);
}

async function loadKanbanTickets() {
  try {
    const department = document.getElementById('kanbanDepartmentFilter').value;
    const agent = document.getElementById('kanbanAgentFilter').value;

    let url = '/tickets?limit=1000';
    if (department) url += `&department=${department}`;
    if (agent) url += `&assignedTo=${agent}`;

    const response = await apiFetch(url);
    const tickets = response.data;

    // Agrupar por status
    const ticketsByStatus = {
      open: [],
      waiting_human: [],
      in_progress: [],
      resolved: [],
      closed: []
    };

    tickets.forEach(ticket => {
      if (ticketsByStatus[ticket.status]) {
        ticketsByStatus[ticket.status].push(ticket);
      }
    });

    // Renderizar cada coluna
    renderKanbanColumn('columnOpen', ticketsByStatus.open, 'countOpen');
    renderKanbanColumn('columnWaiting', ticketsByStatus.waiting_human, 'countWaiting');
    renderKanbanColumn('columnProgress', ticketsByStatus.in_progress, 'countProgress');
    renderKanbanColumn('columnResolved', ticketsByStatus.resolved, 'countResolved');
    renderKanbanColumn('columnClosed', ticketsByStatus.closed, 'countClosed');

    // Inicializar drag and drop
    initializeDragAndDrop();

  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao carregar tickets do Kanban', variant: 'danger' });
  }
}

function renderKanbanColumn(columnId, tickets, countId) {
  const column = document.getElementById(columnId);
  const countBadge = document.getElementById(countId);
  
  if (!column) return;

  countBadge.textContent = tickets.length;

  if (tickets.length === 0) {
    column.innerHTML = '<div class="kanban-empty">Nenhum ticket</div>';
    return;
  }

  column.innerHTML = tickets.map(ticket => `
    <div class="kanban-card" draggable="true" data-ticket-id="${ticket.id}" data-status="${ticket.status}">
      <div class="kanban-card-header">
        <span class="badge bg-secondary">#${escapeHtml(ticket.protocol)}</span>
        <span class="text-muted small">${new Date(ticket.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="kanban-card-body">
        <h6>${escapeHtml(ticket.subject)}</h6>
        <p class="text-muted small mb-2">${escapeHtml(ticket.userId.split('@')[0])}</p>
        ${ticket.department ? `<span class="badge bg-info">${escapeHtml(ticket.department)}</span>` : ''}
      </div>
      <div class="kanban-card-footer">
        <small class="text-muted">
          <i class="bi bi-clock"></i> ${formatTime(ticket.createdAt)}
        </small>
      </div>
    </div>
  `).join('');
}

function initializeDragAndDrop() {
  const cards = document.querySelectorAll('.kanban-card');
  const columns = document.querySelectorAll('.kanban-column-body');

  // Drag start
  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', card.innerHTML);
      e.dataTransfer.setData('ticketId', card.dataset.ticketId);
      e.dataTransfer.setData('oldStatus', card.dataset.status);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', (e) => {
      card.classList.remove('dragging');
    });
  });

  // Drop zones
  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', (e) => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');

      const ticketId = e.dataTransfer.getData('ticketId');
      const oldStatus = e.dataTransfer.getData('oldStatus');
      const newStatus = column.dataset.status;

      if (oldStatus === newStatus) return;

      // Atualizar status do ticket via API
      try {
        await apiFetch(`/tickets/${ticketId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });

        createToast({ 
          title: 'Sucesso', 
          message: `Ticket movido para ${getStatusLabel(newStatus)}`, 
          variant: 'success' 
        });

        // Recarregar Kanban
        await loadKanbanTickets();

      } catch (error) {
        createToast({ 
          title: 'Erro', 
          message: 'Falha ao atualizar status do ticket', 
          variant: 'danger' 
        });
      }
    });
  });
}

function getStatusLabel(status) {
  const labels = {
    open: 'Abertos',
    waiting_human: 'Aguardando',
    in_progress: 'Em Atendimento',
    resolved: 'Resolvidos',
    closed: 'Fechados'
  };
  return labels[status] || status;
}

function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d atrás`;
  if (diffHours > 0) return `${diffHours}h atrás`;
  if (diffMins > 0) return `${diffMins}m atrás`;
  return 'Agora';
}

