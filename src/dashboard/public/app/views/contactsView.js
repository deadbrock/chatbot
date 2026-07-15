import { apiFetch } from '../api.js';
import { navigateToSection } from '../router.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';
import { escapeHtml } from '../ui/dom.js';
import { resolveContactDisplayName, getContactInitials } from '../utils/contactDisplay.js';

/**
 * View de Gestão de Contatos
 */

let currentPage = 1;
let currentFilters = {};
let contactModal = null;
let importModal = null;

/**
 * Renderizar lista de contatos
 */
export async function renderContacts() {
  const container = document.getElementById('contactsContent');
  if (!container) return;

  showLoading();

  try {
    const data = await apiFetch(`/contacts?page=${currentPage}&limit=50&${new URLSearchParams(currentFilters)}`);
    
    container.innerHTML = `
      <div class="contacts-toolbar mb-3">
        <div class="row g-3">
          <div class="col-md-4">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input type="text" class="form-control" id="contactSearch" placeholder="Buscar por nome, telefone, email...">
            </div>
          </div>
          <div class="col-md-2">
            <select class="form-select" id="categoryFilter">
              <option value="">Todas as categorias</option>
              <option value="Cliente">Cliente</option>
              <option value="Lead">Lead</option>
              <option value="Fornecedor">Fornecedor</option>
              <option value="Parceiro">Parceiro</option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-select" id="statusFilter">
              <option value="">Todos os status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
          <div class="col-md-4 text-end">
            <button class="btn btn-outline-primary" id="exportBtn">
              <i class="bi bi-download"></i> Exportar
            </button>
            <button class="btn btn-outline-success" id="importBtn">
              <i class="bi bi-upload"></i> Importar
            </button>
            <button class="btn btn-primary" id="newContactBtn">
              <i class="bi bi-plus-lg"></i> Novo Contato
            </button>
          </div>
        </div>
      </div>

      <!-- Estatísticas -->
      <div class="row g-3 mb-4">
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-primary mb-0" id="totalContacts">0</h3>
              <small class="text-muted">Total de Contatos</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-success mb-0" id="activeContacts">0</h3>
              <small class="text-muted">Ativos</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-danger mb-0" id="blockedContacts">0</h3>
              <small class="text-muted">Bloqueados</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-info mb-0" id="recentContacts">0</h3>
              <small class="text-muted">Novos (30 dias)</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabela de Contatos -->
      <div class="card">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Email</th>
                  <th>Categoria</th>
                  <th>Empresa</th>
                  <th>Tickets</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="contactsTableBody">
                <!-- Contatos serão carregados aqui -->
              </tbody>
            </table>
          </div>

          <!-- Paginação -->
          <nav aria-label="Paginação de contatos">
            <ul class="pagination justify-content-center" id="contactsPagination">
              <!-- Paginação será carregada aqui -->
            </ul>
          </nav>
        </div>
      </div>
    `;

    // Carregar estatísticas
    loadContactStats();

    // Renderizar tabela
    const contacts = Array.isArray(data.contacts) ? data.contacts : (data.data?.contacts || data.data || []);
    const pagination = data.pagination || data.data?.pagination || { page: 1, pages: 1, total: contacts.length };
    
    renderContactsTable(contacts);
    if (pagination && pagination.page && pagination.pages) {
      renderPagination(pagination);
    }

    // Event listeners
    setupEventListeners();

  } catch (error) {
    showToast('Erro ao carregar contatos', 'error');
    console.error(error);
  } finally {
    hideLoading();
  }
}

/**
 * Carregar estatísticas
 */
async function loadContactStats() {
  try {
    const stats = await apiFetch('/contacts/stats');
    
    document.getElementById('totalContacts').textContent = stats.total || 0;
    document.getElementById('activeContacts').textContent = stats.active || 0;
    document.getElementById('blockedContacts').textContent = stats.blocked || 0;
    document.getElementById('recentContacts').textContent = stats.recentContacts || 0;
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

/**
 * Renderizar tabela de contatos
 */
function renderContactsTable(contacts) {
  const tbody = document.getElementById('contactsTableBody');
  if (!tbody) return;

  if (!contacts || contacts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted py-4">
          <i class="bi bi-inbox" style="font-size: 2rem;"></i>
          <p class="mt-2">Nenhum contato encontrado</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contacts.map(contact => {
    const displayName = resolveContactDisplayName(contact);
    const phone = contact.phone || '';
    return `
    <tr>
      <td>
        <div class="d-flex align-items-center">
          ${contact.profilePicUrl ? 
            `<img src="${escapeHtml(contact.profilePicUrl)}" class="rounded-circle me-2" width="32" height="32" alt="">` :
            `<div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;">
              ${escapeHtml(getContactInitials(displayName, phone))}
            </div>`
          }
          <div>
            <strong>${escapeHtml(displayName)}</strong>
            ${contact.tags && contact.tags.length > 0 ? `
              <div class="mt-1">
                ${contact.tags.slice(0, 3).map(tag => `<span class="badge bg-secondary badge-sm">${escapeHtml(tag)}</span>`).join(' ')}
              </div>
            ` : ''}
          </div>
        </div>
      </td>
      <td>${escapeHtml(contact.phone)}</td>
      <td>${contact.email ? escapeHtml(contact.email) : '-'}</td>
      <td>
        ${contact.category ? `<span class="badge bg-info">${escapeHtml(contact.category)}</span>` : '-'}
      </td>
      <td>${contact.company ? escapeHtml(contact.company) : '-'}</td>
      <td><span class="badge bg-primary">${contact.ticketsCount || 0}</span></td>
      <td>
        ${contact.isBlocked ? 
          '<span class="badge bg-danger">Bloqueado</span>' :
          contact.isActive ? 
            '<span class="badge bg-success">Ativo</span>' :
            '<span class="badge bg-secondary">Inativo</span>'
        }
      </td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-success" onclick="window.startContactChat('${contact.id}')" title="Iniciar conversa">
            <i class="bi bi-chat-dots"></i>
          </button>
          <button class="btn btn-outline-primary" onclick="window.editContact('${contact.id}')" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-warning" onclick="window.toggleBlockContact('${contact.id}')" title="${contact.isBlocked ? 'Desbloquear' : 'Bloquear'}">
            <i class="bi bi-${contact.isBlocked ? 'unlock' : 'lock'}"></i>
          </button>
          <button class="btn btn-outline-danger" onclick="window.deleteContact('${contact.id}')" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

/**
 * Renderizar paginação
 */
function renderPagination(pagination) {
  const container = document.getElementById('contactsPagination');
  if (!container) return;

  if (!pagination || typeof pagination !== 'object') {
    container.innerHTML = '';
    return;
  }

  const { page = 1, pages = 1 } = pagination;
  let html = '';

  // Botão anterior
  html += `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${page - 1}">Anterior</a>
    </li>
  `;

  // Páginas
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
      html += `
        <li class="page-item ${i === page ? 'active' : ''}">
          <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>
      `;
    } else if (i === page - 3 || i === page + 3) {
      html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }
  }

  // Botão próximo
  html += `
    <li class="page-item ${page === pages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${page + 1}">Próximo</a>
    </li>
  `;

  container.innerHTML = html;

  // Event listeners para paginação
  container.querySelectorAll('a.page-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const newPage = parseInt(e.target.dataset.page);
      if (newPage && newPage !== currentPage) {
        currentPage = newPage;
        renderContacts();
      }
    });
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Busca
  const searchInput = document.getElementById('contactSearch');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value;
        currentPage = 1;
        renderContacts();
      }, 500);
    });
  }

  // Filtros
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      currentFilters.category = e.target.value;
      currentPage = 1;
      renderContacts();
    });
  }

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      currentFilters.isActive = e.target.value;
      currentPage = 1;
      renderContacts();
    });
  }

  // Botões
  document.getElementById('newContactBtn')?.addEventListener('click', () => openContactModal());
  document.getElementById('exportBtn')?.addEventListener('click', exportContacts);
  document.getElementById('importBtn')?.addEventListener('click', openImportModal);
}

/**
 * Abrir modal de contato
 */
function openContactModal(contactId = null) {
  const modal = document.getElementById('contactModal');
  if (!modal) return;

  const title = document.getElementById('contactModalTitle');
  const form = document.getElementById('contactForm');

  if (contactId) {
    title.textContent = 'Editar Contato';
    loadContactData(contactId);
  } else {
    title.textContent = 'Novo Contato';
    form.reset();
    document.getElementById('contactId').value = '';
  }

  contactModal = new bootstrap.Modal(modal);
  contactModal.show();
}

/**
 * Carregar dados do contato
 */
async function loadContactData(contactId) {
  try {
    const contact = await apiFetch(`/contacts/${contactId}`);
    
    document.getElementById('contactId').value = contact.id;
    document.getElementById('contactName').value = contact.name || '';
    document.getElementById('contactPhone').value = contact.phone || '';
    document.getElementById('contactWhatsappId').value = contact.whatsappId || '';
    document.getElementById('contactEmail').value = contact.email || '';
    document.getElementById('contactCategory').value = contact.category || '';
    document.getElementById('contactCompany').value = contact.company || '';
    document.getElementById('contactPosition').value = contact.position || '';
    document.getElementById('contactNotes').value = contact.notes || '';
  } catch (error) {
    showToast('Erro ao carregar dados do contato', 'error');
  }
}

/**
 * Salvar contato
 */
window.saveContact = async function() {
  const form = document.getElementById('contactForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const contactId = document.getElementById('contactId').value;
  const data = {
    name: document.getElementById('contactName').value,
    phone: document.getElementById('contactPhone').value,
    whatsappId: document.getElementById('contactWhatsappId').value,
    email: document.getElementById('contactEmail').value || null,
    category: document.getElementById('contactCategory').value || null,
    company: document.getElementById('contactCompany').value || null,
    position: document.getElementById('contactPosition').value || null,
    notes: document.getElementById('contactNotes').value || null
  };

  try {
    if (contactId) {
      await apiFetch(`/contacts/${contactId}`, { method: 'PUT', body: data });
      showToast('Contato atualizado com sucesso!', 'success');
    } else {
      await apiFetch('/contacts', { method: 'POST', body: data });
      showToast('Contato criado com sucesso!', 'success');
    }

    contactModal.hide();
    renderContacts();
  } catch (error) {
    showToast(error.message || 'Erro ao salvar contato', 'error');
  }
};

/**
 * Iniciar conversa com contato
 */
window.startContactChat = async function(contactId) {
  try {
    showLoading();

    const contactResponse = await apiFetch(`/contacts/${contactId}`);
    const contact = contactResponse?.data || contactResponse;

    if (!contact?.id) {
      showToast('Contato não encontrado', 'error');
      return;
    }

    if (contact.isBlocked) {
      showToast('Este contato está bloqueado. Desbloqueie para iniciar a conversa.', 'warning');
      return;
    }

    const conversationsResponse = await apiFetch('/conversations?limit=200');
    const conversations = Array.isArray(conversationsResponse?.data)
      ? conversationsResponse.data
      : (Array.isArray(conversationsResponse) ? conversationsResponse : []);

    const contactIdStr = String(contact.id);
    const phone = contact.phone || '';
    const whatsappId = contact.whatsappId || (phone ? `${phone}@s.whatsapp.net` : null);

    let conversation = conversations.find((c) => {
      const sameContact = String(c.contactId) === contactIdStr;
      const sameJid = whatsappId && c.whatsappJid === whatsappId;
      const samePhone = phone && (c.userPhone === phone || c.whatsappJid?.includes(phone));
      return sameContact || sameJid || samePhone;
    });

    if (!conversation?.id) {
      showToast('Conversa não encontrada. Sincronize o WhatsApp ou aguarde mensagem deste contato.', 'warning');
      return;
    }

    navigateToSection('chat');

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openChat', { detail: { conversationId: conversation.id } }));
    }, 300);

    showToast(`Conversa com ${resolveContactDisplayName(contact)} aberta`, 'success');
  } catch (error) {
    console.error('Erro ao iniciar conversa:', error);
    showToast(error.message || 'Erro ao iniciar conversa', 'error');
  } finally {
    hideLoading();
  }
};

/**
 * Editar contato
 */
window.editContact = function(contactId) {
  openContactModal(contactId);
};

/**
 * Bloquear/Desbloquear contato
 */
window.toggleBlockContact = async function(contactId) {
  if (!confirm('Deseja alterar o status de bloqueio deste contato?')) return;

  try {
    await apiFetch(`/contacts/${contactId}/toggle-block`, { method: 'POST' });
    showToast('Status alterado com sucesso!', 'success');
    renderContacts();
  } catch (error) {
    showToast('Erro ao alterar status', 'error');
  }
};

/**
 * Excluir contato
 */
window.deleteContact = async function(contactId) {
  if (!confirm('Deseja realmente excluir este contato? Esta ação não pode ser desfeita.')) return;

  try {
    await apiFetch(`/contacts/${contactId}`, { method: 'DELETE' });
    showToast('Contato excluído com sucesso!', 'success');
    renderContacts();
  } catch (error) {
    showToast('Erro ao excluir contato', 'error');
  }
};

/**
 * Exportar contatos
 */
async function exportContacts() {
  try {
    const contacts = await apiFetch(`/contacts/export?${new URLSearchParams(currentFilters)}`);
    
    // Converter para CSV
    const csv = convertToCSV(contacts);
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showToast('Contatos exportados com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao exportar contatos', 'error');
  }
}

/**
 * Converter para CSV
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      return value ? `"${String(value).replace(/"/g, '""')}"` : '';
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Abrir modal de importação
 */
function openImportModal() {
  const modal = document.getElementById('importModal');
  if (!modal) return;

  importModal = new bootstrap.Modal(modal);
  importModal.show();
}

/**
 * Importar contatos
 */
window.importContacts = async function() {
  const fileInput = document.getElementById('importFile');
  if (!fileInput.files || !fileInput.files[0]) {
    showToast('Selecione um arquivo para importar', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const csv = e.target.result;
      const contacts = parseCSV(csv);
      
      const result = await apiFetch('/contacts/import', {
        method: 'POST',
        body: JSON.stringify({ contacts })
      });

      showToast(`Importação concluída! ${result.success} sucesso, ${result.errors} erros, ${result.skipped} ignorados`, 'success');
      importModal.hide();
      renderContacts();
    } catch (error) {
      showToast('Erro ao importar contatos', 'error');
    }
  };

  reader.readAsText(file);
};

/**
 * Parse CSV
 */
function parseCSV(csv) {
  const lines = csv.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const contacts = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const contact = {};
    
    headers.forEach((header, index) => {
      contact[header] = values[index] || null;
    });
    
    contacts.push(contact);
  }

  return contacts;
}

