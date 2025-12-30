import { apiFetch } from '../api.js';
import { createToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';

/**
 * View de Tags
 */

let currentTags = [];
let currentEditingId = null;

export async function renderTags({ apiFetch, createToast, escapeHtml }) {
  const content = document.getElementById('tagsContent');
  if (!content) return;

  content.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h2><i class="bi bi-tags"></i> Tags</h2>
        <p class="text-muted">Etiquetas para categorizar e organizar tickets</p>
      </div>
      <button class="btn btn-primary" id="newTagBtn">
        <i class="bi bi-plus-lg"></i> Nova Tag
      </button>
    </div>

    <!-- Filtros -->
    <div class="row mb-3">
      <div class="col-md-6">
        <input type="text" class="form-control" id="tagSearch" placeholder="🔍 Buscar tags...">
      </div>
      <div class="col-md-3">
        <select class="form-select" id="tagCategoryFilter">
          <option value="">Todas as Categorias</option>
          <option value="Prioridade">Prioridade</option>
          <option value="Tipo">Tipo</option>
          <option value="Status">Status</option>
        </select>
      </div>
      <div class="col-md-3">
        <select class="form-select" id="tagStatusFilter">
          <option value="">Todos os Status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </div>
    </div>

    <!-- Grid de Tags -->
    <div class="row g-3 mb-4" id="tagsGrid">
      <div class="col-12 text-center text-muted py-4">Carregando...</div>
    </div>

    <!-- Modal de Criar/Editar -->
    <div class="modal fade" id="tagModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="tagModalTitle">Nova Tag</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <form id="tagForm">
              <div class="mb-3">
                <label class="form-label">Nome *</label>
                <input type="text" class="form-control" id="tagName" placeholder="Urgente" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Cor *</label>
                <input type="color" class="form-control form-control-color" id="tagColor" value="#6c757d">
              </div>
              <div class="mb-3">
                <label class="form-label">Ícone (Bootstrap Icons)</label>
                <input type="text" class="form-control" id="tagIcon" placeholder="exclamation-triangle">
                <small class="text-muted">Exemplos: star, flag, bookmark, heart</small>
              </div>
              <div class="mb-3">
                <label class="form-label">Categoria</label>
                <input type="text" class="form-control" id="tagCategory" placeholder="Prioridade">
              </div>
              <div class="mb-3">
                <label class="form-label">Descrição</label>
                <textarea class="form-control" id="tagDescription" rows="2"></textarea>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="tagIsActive" checked>
                <label class="form-check-label" for="tagIsActive">Ativo</label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="saveTagBtn">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('newTagBtn').addEventListener('click', () => openTagModal());
  document.getElementById('saveTagBtn').addEventListener('click', () => saveTag());
  document.getElementById('tagSearch').addEventListener('input', () => loadTags());
  document.getElementById('tagCategoryFilter').addEventListener('change', () => loadTags());
  document.getElementById('tagStatusFilter').addEventListener('change', () => loadTags());

  // Carregar dados
  await loadTags();
}

async function loadTags() {
  const search = document.getElementById('tagSearch').value;
  const category = document.getElementById('tagCategoryFilter').value;
  const isActive = document.getElementById('tagStatusFilter').value;

  try {
    let url = '/tags?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (category) url += `category=${encodeURIComponent(category)}&`;
    if (isActive) url += `isActive=${isActive}&`;

    const response = await apiFetch(url);
    currentTags = response.data || [];

    renderTagsGrid(currentTags);
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao carregar tags', variant: 'danger' });
  }
}

function renderTagsGrid(tags) {
  const grid = document.getElementById('tagsGrid');
  if (!grid) return;

  if (tags.length === 0) {
    grid.innerHTML = '<div class="col-12 text-center text-muted py-4">Nenhuma tag encontrada</div>';
    return;
  }

  grid.innerHTML = tags.map(tag => `
    <div class="col-lg-3 col-md-4 col-sm-6">
      <div class="card tag-card" style="border-left: 4px solid ${escapeHtml(tag.color)}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div class="d-flex align-items-center gap-2">
              ${tag.icon ? `<i class="bi bi-${escapeHtml(tag.icon)}" style="color: ${escapeHtml(tag.color)}"></i>` : ''}
              <h6 class="mb-0">${escapeHtml(tag.name)}</h6>
            </div>
            <span class="badge bg-${tag.isActive ? 'success' : 'secondary'} badge-sm">
              ${tag.isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          ${tag.description ? `<p class="small text-muted mb-2">${escapeHtml(tag.description)}</p>` : ''}
          <div class="d-flex justify-content-between align-items-center">
            <small class="text-muted"><i class="bi bi-bar-chart"></i> ${tag.usageCount} usos</small>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-outline-primary" onclick="editTag('${tag.id}')" title="Editar">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="deleteTag('${tag.id}')" title="Excluir">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function openTagModal(tagId = null) {
  currentEditingId = tagId;
  const modal = new window.bootstrap.Modal(document.getElementById('tagModal'));
  const title = document.getElementById('tagModalTitle');

  if (tagId) {
    title.textContent = 'Editar Tag';
    const tag = currentTags.find(t => t.id === tagId);
    if (tag) {
      document.getElementById('tagName').value = tag.name;
      document.getElementById('tagColor').value = tag.color;
      document.getElementById('tagIcon').value = tag.icon || '';
      document.getElementById('tagCategory').value = tag.category || '';
      document.getElementById('tagDescription').value = tag.description || '';
      document.getElementById('tagIsActive').checked = tag.isActive;
    }
  } else {
    title.textContent = 'Nova Tag';
    document.getElementById('tagForm').reset();
    document.getElementById('tagColor').value = '#6c757d';
    document.getElementById('tagIsActive').checked = true;
  }

  modal.show();
}

async function saveTag() {
  const name = document.getElementById('tagName').value.trim();
  const color = document.getElementById('tagColor').value;
  const icon = document.getElementById('tagIcon').value.trim();
  const category = document.getElementById('tagCategory').value.trim();
  const description = document.getElementById('tagDescription').value.trim();
  const isActive = document.getElementById('tagIsActive').checked;

  if (!name) {
    createToast({ title: 'Erro', message: 'Nome é obrigatório', variant: 'danger' });
    return;
  }

  try {
    const data = { name, color, icon, category, description, isActive };

    if (currentEditingId) {
      await apiFetch(`/tags/${currentEditingId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      createToast({ title: 'Sucesso', message: 'Tag atualizada!', variant: 'success' });
    } else {
      await apiFetch('/tags', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      createToast({ title: 'Sucesso', message: 'Tag criada!', variant: 'success' });
    }

    window.bootstrap.Modal.getInstance(document.getElementById('tagModal')).hide();
    await loadTags();
  } catch (error) {
    createToast({ title: 'Erro', message: error.message || 'Falha ao salvar', variant: 'danger' });
  }
}

async function deleteTag(id) {
  if (!confirm('Tem certeza que deseja excluir esta tag?')) return;

  try {
    await apiFetch(`/tags/${id}`, { method: 'DELETE' });
    createToast({ title: 'Sucesso', message: 'Tag excluída!', variant: 'success' });
    await loadTags();
  } catch (error) {
    createToast({ title: 'Erro', message: 'Falha ao excluir', variant: 'danger' });
  }
}

// Expor funções globalmente
window.editTag = (id) => openTagModal(id);
window.deleteTag = deleteTag;

