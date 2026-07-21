import { apiFetch } from '../api.js';
import { navigateToSection } from '../router.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';
import { escapeHtml } from '../ui/dom.js';
import { resolveContactDisplayName, getContactInitials } from '../utils/contactDisplay.js';

const EMPLOYEE_POSITIONS = [
  'Gestor',
  'Coordenador',
  'Supervisor',
  'Encarregado',
  'Demais Cargos'
];

let currentPage = 1;
let currentFilters = {};
let contactModal = null;
let importModal = null;

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildWhatsappId(phone) {
  const digits = normalizePhoneDigits(phone);
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function isRegisteredEmployee(contact) {
  return contact?.category === 'Colaborador'
    && ['Manual', 'Importação'].includes(contact?.source);
}

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
              <input type="text" class="form-control" id="contactSearch" placeholder="Buscar por nome, telefone, contrato...">
            </div>
          </div>
          <div class="col-md-2">
            <select class="form-select" id="positionFilter">
              <option value="">Todos os cargos</option>
              ${EMPLOYEE_POSITIONS.map((p) => `<option value="${p}">${p}</option>`).join('')}
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
              <i class="bi bi-plus-lg"></i> Novo Funcionário
            </button>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-md-3">
          <div class="card text-center">
            <div class="card-body">
              <h3 class="text-primary mb-0" id="totalContacts">0</h3>
              <small class="text-muted">Total de Funcionários</small>
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

      <div class="card">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Contrato</th>
                  <th>Cargo</th>
                  <th>Cidade/UF</th>
                  <th>Tickets</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="contactsTableBody"></tbody>
            </table>
          </div>

          <nav aria-label="Paginação de funcionários">
            <ul class="pagination justify-content-center" id="contactsPagination"></ul>
          </nav>
        </div>
      </div>
    `;

    loadContactStats();

    const contacts = Array.isArray(data.contacts) ? data.contacts : (data.data?.contacts || data.data || []);
    const pagination = data.pagination || data.data?.pagination || { page: 1, pages: 1, total: contacts.length };

    renderContactsTable(contacts);
    if (pagination?.page && pagination?.pages) {
      renderPagination(pagination);
    }

    setupEventListeners();
  } catch (error) {
    showToast('Erro ao carregar funcionários', 'error');
    console.error(error);
  } finally {
    hideLoading();
  }
}

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

function renderContactsTable(contacts) {
  const tbody = document.getElementById('contactsTableBody');
  if (!tbody) return;

  if (!contacts?.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-muted py-4">
          <i class="bi bi-inbox" style="font-size: 2rem;"></i>
          <p class="mt-2">Nenhum funcionário cadastrado</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contacts.map((contact) => {
    const displayName = resolveContactDisplayName(contact);
    const phone = contact.phone || '';
    const location = [contact.city, contact.state].filter(Boolean).join(' / ') || '-';

    return `
    <tr>
      <td>
        <div class="d-flex align-items-center">
          ${contact.profilePicUrl
            ? `<img src="${escapeHtml(contact.profilePicUrl)}" class="rounded-circle me-2" width="32" height="32" alt="">`
            : `<div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;">
              ${escapeHtml(getContactInitials(displayName, phone))}
            </div>`
          }
          <div>
            <strong>${escapeHtml(displayName)}</strong>
            ${contact.email ? `<div class="small text-muted">${escapeHtml(contact.email)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${escapeHtml(contact.phone || '-')}</td>
      <td>${contact.contract ? escapeHtml(contact.contract) : '-'}</td>
      <td>${contact.position ? `<span class="badge bg-info">${escapeHtml(contact.position)}</span>` : '-'}</td>
      <td>${escapeHtml(location)}</td>
      <td><span class="badge bg-primary">${contact.ticketsCount || 0}</span></td>
      <td>
        ${contact.isBlocked
          ? '<span class="badge bg-danger">Bloqueado</span>'
          : contact.isActive
            ? '<span class="badge bg-success">Ativo</span>'
            : '<span class="badge bg-secondary">Inativo</span>'
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

function renderPagination(pagination) {
  const container = document.getElementById('contactsPagination');
  if (!container) return;

  const { page = 1, pages = 1 } = pagination;
  let html = `
    <li class="page-item ${page === 1 ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${page - 1}">Anterior</a>
    </li>
  `;

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

  html += `
    <li class="page-item ${page === pages ? 'disabled' : ''}">
      <a class="page-link" href="#" data-page="${page + 1}">Próximo</a>
    </li>
  `;

  container.innerHTML = html;
  container.querySelectorAll('a.page-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const newPage = parseInt(e.target.dataset.page, 10);
      if (newPage && newPage !== currentPage) {
        currentPage = newPage;
        renderContacts();
      }
    });
  });
}

function setupEventListeners() {
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

  document.getElementById('positionFilter')?.addEventListener('change', (e) => {
    currentFilters.position = e.target.value;
    currentPage = 1;
    renderContacts();
  });

  document.getElementById('statusFilter')?.addEventListener('change', (e) => {
    currentFilters.isActive = e.target.value;
    currentPage = 1;
    renderContacts();
  });

  document.getElementById('newContactBtn')?.addEventListener('click', () => openContactModal());
  document.getElementById('exportBtn')?.addEventListener('click', exportContacts);
  document.getElementById('importBtn')?.addEventListener('click', openImportModal);

  const phoneInput = document.getElementById('contactPhone');
  phoneInput?.addEventListener('input', (e) => {
    const whatsappField = document.getElementById('contactWhatsappId');
    if (whatsappField) {
      whatsappField.value = buildWhatsappId(e.target.value);
    }
  });
}

export function openContactModal(contactId = null, prefill = {}) {
  const modal = document.getElementById('contactModal');
  if (!modal) return;

  const title = document.getElementById('contactModalTitle');
  const form = document.getElementById('contactForm');

  if (contactId) {
    title.textContent = 'Editar Funcionário';
    loadContactData(contactId);
  } else {
    title.textContent = 'Novo Funcionário';
    form.reset();
    document.getElementById('contactId').value = '';
    document.getElementById('contactConversationId').value = prefill.conversationId || '';

    if (prefill.name) document.getElementById('contactName').value = prefill.name;
    if (prefill.phone) {
      document.getElementById('contactPhone').value = prefill.phone;
      document.getElementById('contactWhatsappId').value = prefill.whatsappId || buildWhatsappId(prefill.phone);
    }
    if (prefill.contract) document.getElementById('contactContract').value = prefill.contract;
    if (prefill.position) document.getElementById('contactPosition').value = prefill.position;
    if (prefill.city) document.getElementById('contactCity').value = prefill.city;
    if (prefill.state) document.getElementById('contactState').value = prefill.state;
    if (prefill.email) document.getElementById('contactEmail').value = prefill.email;
    if (prefill.company) document.getElementById('contactCompany').value = prefill.company;
  }

  contactModal = new bootstrap.Modal(modal);
  contactModal.show();
}

async function loadContactData(contactId) {
  try {
    const contact = await apiFetch(`/contacts/${contactId}`);

    document.getElementById('contactId').value = contact.id;
    document.getElementById('contactConversationId').value = '';
    document.getElementById('contactName').value = contact.name || '';
    document.getElementById('contactPhone').value = contact.phone || '';
    document.getElementById('contactWhatsappId').value = contact.whatsappId || buildWhatsappId(contact.phone);
    document.getElementById('contactEmail').value = contact.email || '';
    document.getElementById('contactContract').value = contact.contract || '';
    document.getElementById('contactCompany').value = contact.company || '';
    document.getElementById('contactPosition').value = contact.position || '';
    document.getElementById('contactCity').value = contact.city || '';
    document.getElementById('contactState').value = contact.state || '';
    document.getElementById('contactNotes').value = contact.notes || '';
  } catch (error) {
    showToast('Erro ao carregar dados do funcionário', 'error');
  }
}

window.saveContact = async function saveContact() {
  const form = document.getElementById('contactForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const contactId = document.getElementById('contactId').value;
  const phone = document.getElementById('contactPhone').value;
  const conversationId = document.getElementById('contactConversationId').value || null;

  const data = {
    name: document.getElementById('contactName').value,
    phone,
    whatsappId: document.getElementById('contactWhatsappId').value || buildWhatsappId(phone),
    email: document.getElementById('contactEmail').value || null,
    contract: document.getElementById('contactContract').value,
    company: document.getElementById('contactCompany').value || null,
    position: document.getElementById('contactPosition').value,
    city: document.getElementById('contactCity').value || null,
    state: document.getElementById('contactState').value || null,
    notes: document.getElementById('contactNotes').value || null
  };

  if (!contactId && conversationId) {
    data.conversationId = conversationId;
  }

  try {
    if (contactId) {
      await apiFetch(`/contacts/${contactId}`, { method: 'PUT', body: data });
      showToast('Funcionário atualizado com sucesso!', 'success');
    } else {
      await apiFetch('/contacts', { method: 'POST', body: data });
      showToast('Funcionário cadastrado com sucesso!', 'success');
    }

    contactModal?.hide();
    renderContacts();

    if (conversationId) {
      window.dispatchEvent(new CustomEvent('employeeRegistered', {
        detail: { conversationId }
      }));
    }
  } catch (error) {
    showToast(error.message || 'Erro ao salvar funcionário', 'error');
  }
};

window.startContactChat = async function startContactChat(contactId) {
  try {
    showLoading();

    const contactResponse = await apiFetch(`/contacts/${contactId}`);
    const contact = contactResponse?.data || contactResponse;

    if (!contact?.id) {
      showToast('Funcionário não encontrado', 'error');
      return;
    }

    if (contact.isBlocked) {
      showToast('Este funcionário está bloqueado.', 'warning');
      return;
    }

    const conversationsResponse = await apiFetch('/conversations?limit=200');
    const conversations = Array.isArray(conversationsResponse?.data)
      ? conversationsResponse.data
      : (Array.isArray(conversationsResponse) ? conversationsResponse : []);

    const contactIdStr = String(contact.id);
    const phone = contact.phone || '';
    const whatsappId = contact.whatsappId || buildWhatsappId(phone);

    const conversation = conversations.find((c) => {
      const sameContact = String(c.contactId) === contactIdStr;
      const sameJid = whatsappId && c.whatsappJid === whatsappId;
      const samePhone = phone && (c.userPhone === phone || c.whatsappJid?.includes(phone));
      return sameContact || sameJid || samePhone;
    });

    if (!conversation?.id) {
      showToast('Conversa não encontrada. Aguarde mensagem deste funcionário ou sincronize o WhatsApp.', 'warning');
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

window.editContact = function editContact(contactId) {
  openContactModal(contactId);
};

window.toggleBlockContact = async function toggleBlockContact(contactId) {
  if (!confirm('Deseja alterar o status de bloqueio deste funcionário?')) return;

  try {
    await apiFetch(`/contacts/${contactId}/toggle-block`, { method: 'POST' });
    showToast('Status alterado com sucesso!', 'success');
    renderContacts();
  } catch (error) {
    showToast('Erro ao alterar status', 'error');
  }
};

window.deleteContact = async function deleteContact(contactId) {
  if (!confirm('Deseja realmente excluir este funcionário? Esta ação não pode ser desfeita.')) return;

  try {
    await apiFetch(`/contacts/${contactId}`, { method: 'DELETE' });
    showToast('Funcionário excluído com sucesso!', 'success');
    renderContacts();
  } catch (error) {
    showToast('Erro ao excluir funcionário', 'error');
  }
};

async function exportContacts() {
  try {
    const contacts = await apiFetch(`/contacts/export?${new URLSearchParams(currentFilters)}`);
    const csv = convertToCSV(contacts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `funcionarios_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('Funcionários exportados com sucesso!', 'success');
  } catch (error) {
    showToast('Erro ao exportar funcionários', 'error');
  }
}

function convertToCSV(data) {
  if (!data?.length) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      return value ? `"${String(value).replace(/"/g, '""')}"` : '';
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

function openImportModal() {
  const modal = document.getElementById('importModal');
  if (!modal) return;

  importModal = new bootstrap.Modal(modal);
  importModal.show();
}

window.importContacts = async function importContacts() {
  const fileInput = document.getElementById('importFile');
  if (!fileInput.files?.[0]) {
    showToast('Selecione um arquivo para importar', 'warning');
    return;
  }

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
      showToast('Erro ao importar funcionários', 'error');
    }
  };

  reader.readAsText(fileInput.files[0]);
};

function parseCSV(csv) {
  const lines = csv.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const contacts = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
    const contact = {};

    headers.forEach((header, index) => {
      contact[header] = values[index] || null;
    });

    contacts.push(contact);
  }

  return contacts;
}

window.addEventListener('openEmployeeModal', (event) => {
  const detail = event.detail || {};
  navigateToSection('contacts');
  setTimeout(() => openContactModal(null, detail), 200);
});

export { isRegisteredEmployee };
