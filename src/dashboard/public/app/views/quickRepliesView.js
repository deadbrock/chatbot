import { apiFetch } from '../api.js';
import { createToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';

/**
 * View de Respostas Rápidas
 */

let currentQuickReplies = [];
let currentEditingId = null;

export async function renderQuickReplies({ apiFetch, createToast, escapeHtml }) {
  const content = document.getElementById('quickRepliesContent');
  if (!content) return;

  content.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2><i class="bi bi-lightning-charge"></i> Respostas Rápidas</h2>
        <p class="text-muted">Mensagens pré-configuradas para agilizar o atendimento</p>
      </div>
      <button class="btn btn-primary" id="newQuickReplyBtn">
        <i class="bi bi-plus-lg"></i> Nova Resposta
      </button>
    </div>

    <!-- Filtros -->
    <div class="row mb-3">
      <div class="col-md-6">
        <input type="text" class="form-control" id="quickReplySearch" placeholder="🔍 Buscar por atalho ou mensagem...">
      </div>
      <div class="col-md-3">
        <select class="form-select" id="quickReplyCategoryFilter">
          <option value="">Todas as Categorias</option>
          <option value="Saudação">Saudação</option>
          <option value="Despedida">Despedida</option>
          <option value="Informação">Informação</option>
          <option value="FAQ">FAQ</option>
        </select>
      </div>
      <div class="col-md-3">
        <select class="form-select" id="quickReplyStatusFilter">
          <option value="">Todos os Status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>
    </div>

    <!-- Tabela -->
    <div class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width: 120px;">Atalho</th>
                <th>Mensagem</th>
                <th style="width: 120px;">Categoria</th>
                <th style="width: 80px;" class="text-center">Uso</th>
                <th style="width: 80px;" class="text-center">Status</th>
                <th style="width: 120px;" class="text-end">Ações</th>
              </tr>
            </thead>
            <tbody id="quickRepliesTable">
              <tr><td colspan="6" class="text-center text-muted py-4">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal de Criar/Editar -->
    <div class="modal fade" id="quickReplyModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="quickReplyModalTitle">Nova Resposta Rápida</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="quickReplyForm">
              <div class="mb-3">
                <label class="form-label">Atalho *</label>
                <input type="text" class="form-control" id="qrShortcut" placeholder="/oi" required>
                <small class="text-muted">Deve começar com / (ex: /oi, /obrigado)</small>
              </div>
              <div class="mb-3">
                <label class="form-label">Mensagem *</label>
                <textarea class="form-control" id="qrMessage" rows="4" placeholder="Olá {{nome}}! Como posso ajudar?" required></textarea>
                <small class="text-muted">Variáveis disponíveis: {{nome}}, {{protocolo}}, {{data}}</small>
              </div>
              <div class="mb-3">
                <label class="form-label">Categoria</label>
                <input type="text" class="form-control" id="qrCategory" placeholder="Saudação">
              </div>
              <div class="mb-3">
                <label class="form-label">URL de Mídia (opcional)</label>
                <input type="url" class="form-control" id="qrMediaUrl" placeholder="https://...">
              </div>
              <div class="mb-3">
                <label class="form-label">Tipo de Mídia</label>
                <select class="form-select" id="qrMediaType">
                  <option value="">Nenhum</option>
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="audio">Áudio</option>
                  <option value="document">Documento</option>
                </select>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="qrIsActive" checked>
                <label class="form-check-label" for="qrIsActive">Ativo</label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveQuickReplyBtn">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('newQuickReplyBtn').addEventListener('click', () => openQuickReplyModal());
  document.getElementById('saveQuickReplyBtn').addEventListener('click', () => saveQuickReply());
  document.getElementById('quickReplySearch').addEventListener('input', () => loadQuickReplies());
  document.getElementById('quickReplyCategoryFilter').addEventListener('change', () => loadQuickReplies());
  document.getElementById('quickReplyStatusFilter').addEventListener('change', () => loadQuickReplies());

  // Carregar dados
  await loadQuickReplies();
}

async function loadQuickReplies() {
  const search = document.getElementById('quickReplySearch').value;
  const category = document.getElementById('quickReplyCategoryFilter').value;
  const isActive = document.getElementById('quickReplyStatusFilter').value;

  try {
    let url = '/quick-replies?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (category) url += `category=${encodeURIComponent(category)}&`;
    if (isActive) url += `isActive=${isActive}&`;

    const response = await apiFetch(url);
    currentQuickReplies = response.data || [];

    renderQuickRepliesTable(currentQuickReplies);
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao carregar respostas rápidas', variant: 'danger' });
  }
}

function renderQuickRepliesTable(quickReplies) {
  const tbody = document.getElementById('quickRepliesTable');
  if (!tbody) return;

  if (quickReplies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma resposta rápida encontrada</td></tr>';
    return;
  }

  tbody.innerHTML = quickReplies.map(qr => `
    <tr>
      <td><code class="text-primary">${escapeHtml(qr.shortcut)}</code></td>
      <td>
        <div style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${escapeHtml(qr.message)}
        </div>
        ${qr.variables?.length ? `<small class="text-muted">Variáveis: ${qr.variables.join(', ')}</small>` : ''}
      </td>
      <td><span class="badge bg-secondary">${escapeHtml(qr.category || '—')}</span></td>
      <td class="text-center"><span class="badge bg-info">${qr.usageCount}</span></td>
      <td class="text-center">
        <span class="badge bg-${qr.isActive ? 'success' : 'secondary'}">
          ${qr.isActive ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editQuickReply('${qr.id}')" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-${qr.isActive ? 'warning' : 'success'}" onclick="toggleQuickReply('${qr.id}')" title="${qr.isActive ? 'Desativar' : 'Ativar'}">
          <i class="bi bi-${qr.isActive ? 'pause' : 'play'}-circle"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteQuickReply('${qr.id}')" title="Excluir">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function openQuickReplyModal(qrId = null) {
  currentEditingId = qrId;
  const modal = new window.bootstrap.Modal(document.getElementById('quickReplyModal'));
  const title = document.getElementById('quickReplyModalTitle');

  if (qrId) {
    title.textContent = 'Editar Resposta Rápida';
    const qr = currentQuickReplies.find(q => q.id === qrId);
    if (qr) {
      document.getElementById('qrShortcut').value = qr.shortcut;
      document.getElementById('qrMessage').value = qr.message;
      document.getElementById('qrCategory').value = qr.category || '';
      document.getElementById('qrMediaUrl').value = qr.mediaUrl || '';
      document.getElementById('qrMediaType').value = qr.mediaType || '';
      document.getElementById('qrIsActive').checked = qr.isActive;
    }
  } else {
    title.textContent = 'Nova Resposta Rápida';
    document.getElementById('quickReplyForm').reset();
    document.getElementById('qrIsActive').checked = true;
  }

  modal.show();
}

async function saveQuickReply() {
  const shortcut = document.getElementById('qrShortcut').value.trim();
  const message = document.getElementById('qrMessage').value.trim();
  const category = document.getElementById('qrCategory').value.trim();
  const mediaUrl = document.getElementById('qrMediaUrl').value.trim();
  const mediaType = document.getElementById('qrMediaType').value;
  const isActive = document.getElementById('qrIsActive').checked;

  if (!shortcut || !message) {
    createToast({ title: 'Erro', message: 'Atalho e mensagem são obrigatórios', variant: 'danger' });
    return;
  }

  if (!shortcut.startsWith('/')) {
    createToast({ title: 'Erro', message: 'Atalho deve começar com /', variant: 'danger' });
    return;
  }

  try {
    const data = { shortcut, message, category, mediaUrl, mediaType, isActive };

    if (currentEditingId) {
      await apiFetch(`/quick-replies/${currentEditingId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      createToast({ title: 'Sucesso', message: 'Resposta rápida atualizada!', variant: 'success' });
    } else {
      await apiFetch('/quick-replies', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      createToast({ title: 'Sucesso', message: 'Resposta rápida criada!', variant: 'success' });
    }

    window.bootstrap.Modal.getInstance(document.getElementById('quickReplyModal')).hide();
    await loadQuickReplies();
  } catch (error) {
    createToast({ title: 'Erro', message: error.message || 'Falha ao salvar', variant: 'danger' });
  }
}

async function toggleQuickReply(id) {
  try {
    await apiFetch(`/quick-replies/${id}/toggle`, { method: 'POST' });
    createToast({ title: 'Sucesso', message: 'Status alterado!', variant: 'success' });
    await loadQuickReplies();
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao alterar status', variant: 'danger' });
  }
}

async function deleteQuickReply(id) {
  if (!confirm('Tem certeza que deseja excluir esta resposta rápida?')) return;

  try {
    await apiFetch(`/quick-replies/${id}`, { method: 'DELETE' });
    createToast({ title: 'Sucesso', message: 'Resposta rápida excluída!', variant: 'success' });
    await loadQuickReplies();
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao excluir', variant: 'danger' });
  }
}

// Expor funções globalmente para uso nos botões
window.editQuickReply = (id) => openQuickReplyModal(id);
window.toggleQuickReply = toggleQuickReply;
window.deleteQuickReply = deleteQuickReply;

