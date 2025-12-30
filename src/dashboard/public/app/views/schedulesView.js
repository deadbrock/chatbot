import { apiFetch } from '../api.js';
import { createToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';

/**
 * View de Agendamentos
 */

let currentSchedules = [];
let currentEditingId = null;

export async function renderSchedules({ apiFetch, createToast, escapeHtml }) {
  const content = document.getElementById('schedulesContent');
  if (!content) return;

  content.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2><i class="bi bi-calendar-event"></i> Agendamentos</h2>
        <p class="text-muted">Mensagens agendadas e follow-ups automáticos</p>
      </div>
      <button class="btn btn-primary" id="newScheduleBtn">
        <i class="bi bi-plus-lg"></i> Novo Agendamento
      </button>
    </div>

    <!-- Estatísticas -->
    <div class="row g-3 mb-4" id="scheduleStats">
      <div class="col-md-3">
        <div class="card bg-warning bg-opacity-10 border-warning">
          <div class="card-body">
            <h6 class="text-muted mb-1">Pendentes</h6>
            <h3 id="statPending">0</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-success bg-opacity-10 border-success">
          <div class="card-body">
            <h6 class="text-muted mb-1">Enviados</h6>
            <h3 id="statSent">0</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-danger bg-opacity-10 border-danger">
          <div class="card-body">
            <h6 class="text-muted mb-1">Falhados</h6>
            <h3 id="statFailed">0</h3>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card bg-secondary bg-opacity-10 border-secondary">
          <div class="card-body">
            <h6 class="text-muted mb-1">Cancelados</h6>
            <h3 id="statCancelled">0</h3>
          </div>
        </div>
      </div>
    </div>

    <!-- Filtros -->
    <div class="row mb-3">
      <div class="col-md-4">
        <select class="form-select" id="scheduleStatusFilter">
          <option value="">Todos os Status</option>
          <option value="pending">Pendentes</option>
          <option value="processing">Processando</option>
          <option value="sent">Enviados</option>
          <option value="failed">Falhados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>
      <div class="col-md-4">
        <select class="form-select" id="scheduleTypeFilter">
          <option value="">Todos os Tipos</option>
          <option value="message">Mensagem</option>
          <option value="follow_up">Follow-up</option>
          <option value="reminder">Lembrete</option>
          <option value="campaign">Campanha</option>
        </select>
      </div>
      <div class="col-md-4">
        <button class="btn btn-outline-secondary w-100" id="refreshSchedules">
          <i class="bi bi-arrow-clockwise"></i> Atualizar
        </button>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th>Tipo</th>
                <th>Destinatário</th>
                <th>Mensagem</th>
                <th>Agendado Para</th>
                <th>Recorrência</th>
                <th class="text-center">Status</th>
                <th class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody id="schedulesTable">
              <tr><td colspan="7" class="text-center text-muted py-4">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal de Criar/Editar -->
    <div class="modal fade" id="scheduleModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="scheduleModalTitle">Novo Agendamento</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="scheduleForm">
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Tipo *</label>
                  <select class="form-select" id="schType" required>
                    <option value="message">Mensagem</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="reminder">Lembrete</option>
                    <option value="campaign">Campanha</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Data e Hora *</label>
                  <input type="datetime-local" class="form-control" id="schScheduledFor" required>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Destinatário (WhatsApp ID) *</label>
                <input type="text" class="form-control" id="schRecipient" placeholder="5511999999999@c.us" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Mensagem *</label>
                <textarea class="form-control" id="schMessage" rows="4" required></textarea>
              </div>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Recorrência</label>
                  <select class="form-select" id="schRepeat">
                    <option value="none">Não repetir</option>
                    <option value="daily">Diariamente</option>
                    <option value="weekly">Semanalmente</option>
                    <option value="monthly">Mensalmente</option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Repetir Até</label>
                  <input type="datetime-local" class="form-control" id="schRepeatUntil">
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">URL de Mídia (opcional)</label>
                <input type="url" class="form-control" id="schMediaUrl">
              </div>
              <div class="mb-3">
                <label class="form-label">Tipo de Mídia</label>
                <select class="form-select" id="schMediaType">
                  <option value="">Nenhum</option>
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="audio">Áudio</option>
                  <option value="document">Documento</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveScheduleBtn">Agendar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('newScheduleBtn').addEventListener('click', () => openScheduleModal());
  document.getElementById('saveScheduleBtn').addEventListener('click', () => saveSchedule());
  document.getElementById('refreshSchedules').addEventListener('click', () => loadSchedules());
  document.getElementById('scheduleStatusFilter').addEventListener('change', () => loadSchedules());
  document.getElementById('scheduleTypeFilter').addEventListener('change', () => loadSchedules());

  // Carregar dados
  await loadSchedules();
  await loadScheduleStats();
}

async function loadSchedules() {
  const status = document.getElementById('scheduleStatusFilter').value;
  const type = document.getElementById('scheduleTypeFilter').value;

  try {
    let url = '/schedules?limit=100';
    if (status) url += `&status=${status}`;
    if (type) url += `&type=${type}`;

    const response = await apiFetch(url);
    currentSchedules = response.data || [];

    renderSchedulesTable(currentSchedules);
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao carregar agendamentos', variant: 'danger' });
  }
}

async function loadScheduleStats() {
  try {
    const response = await apiFetch('/schedules/stats');
    const stats = response;

    document.getElementById('statPending').textContent = stats.pending || 0;
    document.getElementById('statSent').textContent = stats.sent || 0;
    document.getElementById('statFailed').textContent = stats.failed || 0;
    document.getElementById('statCancelled').textContent = stats.cancelled || 0;
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

function renderSchedulesTable(schedules) {
  const tbody = document.getElementById('schedulesTable');
  if (!tbody) return;

  if (schedules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Nenhum agendamento encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = schedules.map(sch => `
    <tr>
      <td><span class="badge bg-info">${formatType(sch.type)}</span></td>
      <td><code class="small">${escapeHtml(sch.recipientId.substring(0, 15))}...</code></td>
      <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${escapeHtml(sch.message)}
      </td>
      <td>${formatDateTime(sch.scheduledFor)}</td>
      <td><span class="badge bg-secondary">${formatRepeat(sch.repeat)}</span></td>
      <td class="text-center">
        <span class="badge bg-${getStatusColor(sch.status)}">${formatStatus(sch.status)}</span>
      </td>
      <td class="text-end">
        ${sch.status === 'pending' ? `
          <button class="btn btn-sm btn-outline-warning me-1" onclick="cancelSchedule('${sch.id}')" title="Cancelar">
            <i class="bi bi-x-circle"></i>
          </button>
        ` : ''}
        ${sch.status === 'failed' ? `
          <button class="btn btn-sm btn-outline-success me-1" onclick="retrySchedule('${sch.id}')" title="Reprocessar">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
        ` : ''}
        ${sch.status !== 'sent' ? `
          <button class="btn btn-sm btn-outline-danger" onclick="deleteSchedule('${sch.id}')" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function openScheduleModal(schId = null) {
  currentEditingId = schId;
  const modal = new window.bootstrap.Modal(document.getElementById('scheduleModal'));
  const title = document.getElementById('scheduleModalTitle');

  title.textContent = 'Novo Agendamento';
  document.getElementById('scheduleForm').reset();

  modal.show();
}

async function saveSchedule() {
  const type = document.getElementById('schType').value;
  const scheduledFor = document.getElementById('schScheduledFor').value;
  const recipientId = document.getElementById('schRecipient').value.trim();
  const message = document.getElementById('schMessage').value.trim();
  const repeat = document.getElementById('schRepeat').value;
  const repeatUntil = document.getElementById('schRepeatUntil').value;
  const mediaUrl = document.getElementById('schMediaUrl').value.trim();
  const mediaType = document.getElementById('schMediaType').value;

  if (!type || !scheduledFor || !recipientId || !message) {
    createToast({ title: 'Erro', message: 'Preencha todos os campos obrigatórios', variant: 'danger' });
    return;
  }

  try {
    const data = { 
      type, 
      scheduledFor, 
      recipientId, 
      message, 
      repeat, 
      repeatUntil: repeatUntil || null,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null
    };

    await apiFetch('/schedules', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    createToast({ title: 'Sucesso', message: 'Agendamento criado!', variant: 'success' });
    window.bootstrap.Modal.getInstance(document.getElementById('scheduleModal')).hide();
    await loadSchedules();
    await loadScheduleStats();
  } catch (error) {
    createToast({ title: 'Erro', message: error.message || 'Falha ao salvar', variant: 'danger' });
  }
}

async function cancelSchedule(id) {
  if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;

  try {
    await apiFetch(`/schedules/${id}/cancel`, { method: 'POST' });
    createToast({ title: 'Sucesso', message: 'Agendamento cancelado!', variant: 'success' });
    await loadSchedules();
    await loadScheduleStats();
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao cancelar', variant: 'danger' });
  }
}

async function retrySchedule(id) {
  try {
    await apiFetch(`/schedules/${id}/retry`, { method: 'POST' });
    createToast({ title: 'Sucesso', message: 'Agendamento marcado para reprocessamento!', variant: 'success' });
    await loadSchedules();
    await loadScheduleStats();
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao reprocessar', variant: 'danger' });
  }
}

async function deleteSchedule(id) {
  if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

  try {
    await apiFetch(`/schedules/${id}`, { method: 'DELETE' });
    createToast({ title: 'Sucesso', message: 'Agendamento excluído!', variant: 'success' });
    await loadSchedules();
    await loadScheduleStats();
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao excluir', variant: 'danger' });
  }
}

function formatType(type) {
  const map = {
    message: 'Mensagem',
    follow_up: 'Follow-up',
    reminder: 'Lembrete',
    campaign: 'Campanha'
  };
  return map[type] || type;
}

function formatRepeat(repeat) {
  const map = {
    none: 'Única',
    daily: 'Diária',
    weekly: 'Semanal',
    monthly: 'Mensal'
  };
  return map[repeat] || repeat;
}

function formatStatus(status) {
  const map = {
    pending: 'Pendente',
    processing: 'Processando',
    sent: 'Enviado',
    failed: 'Falhou',
    cancelled: 'Cancelado'
  };
  return map[status] || status;
}

function getStatusColor(status) {
  const map = {
    pending: 'warning',
    processing: 'info',
    sent: 'success',
    failed: 'danger',
    cancelled: 'secondary'
  };
  return map[status] || 'secondary';
}

function formatDateTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleString('pt-BR');
}

// Expor funções globalmente
window.cancelSchedule = cancelSchedule;
window.retrySchedule = retrySchedule;
window.deleteSchedule = deleteSchedule;

