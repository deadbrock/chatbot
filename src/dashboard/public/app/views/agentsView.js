import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';
import { AGENT_DEPARTMENTS } from '../constants/agentDepartments.js';
import { canManageUsers, getCurrentUserRole } from '../permissions.js';

let agentModal = null;
let agentsReloadHandler = null;

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Gestor',
  agent: 'Atendente',
  viewer: 'Leitura'
};

const STATUS_LABELS = {
  online: 'Online',
  offline: 'Offline',
  away: 'Ausente',
  busy: 'Ocupado'
};

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || '—';
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || '—';
}

function getStatusBadgeClass(status) {
  if (status === 'online') return 'bg-success';
  if (status === 'away') return 'bg-warning text-dark';
  if (status === 'busy') return 'bg-danger';
  return 'bg-secondary';
}

function applyRoleFieldRestrictions() {
  const roleSelect = document.getElementById('agentRole');
  if (!roleSelect) return;

  const currentRole = getCurrentUserRole();
  Array.from(roleSelect.options).forEach((option) => {
    if (currentRole === 'manager' && option.value === 'admin') {
      option.hidden = true;
      option.disabled = true;
    } else {
      option.hidden = false;
      option.disabled = false;
    }
  });

  if (currentRole === 'manager' && roleSelect.value === 'admin') {
    roleSelect.value = 'agent';
  }
}

function populateDepartmentSelect(selectedValue = '') {
  const select = document.getElementById('agentDepartment');
  if (!select) return;

  const options = [
    '<option value="">Selecione um departamento...</option>',
    ...AGENT_DEPARTMENTS.map((dept) => {
      const selected = dept === selectedValue ? ' selected' : '';
      return `<option value="${escapeHtml(dept)}"${selected}>${escapeHtml(dept)}</option>`;
    })
  ];

  select.innerHTML = options.join('');
}

function getAgentModal() {
  const modalEl = document.getElementById('agentModal');
  if (!modalEl || !window.bootstrap) return null;
  if (!agentModal) agentModal = new window.bootstrap.Modal(modalEl);
  return agentModal;
}

function resetAgentForm() {
  const form = document.getElementById('agentForm');
  if (!form) return;

  form.reset();
  document.getElementById('agentId').value = '';
  populateDepartmentSelect();

  const passwordInput = document.getElementById('agentPassword');
  const passwordHint = document.getElementById('agentPasswordHint');
  if (passwordInput) {
    passwordInput.required = true;
    passwordInput.value = '';
  }
  if (passwordHint) passwordHint.style.display = 'none';
}

export function openNewAgentModal() {
  if (!canManageUsers(getCurrentUserRole())) {
    showToast('Você não tem permissão para criar atendentes.', 'warning');
    return;
  }

  resetAgentForm();
  applyRoleFieldRestrictions();

  const title = document.getElementById('agentModalTitle');
  const saveBtn = document.getElementById('saveAgentBtn');
  if (title) title.textContent = 'Novo atendente';
  if (saveBtn) saveBtn.innerHTML = '<i class="bi bi-person-check"></i> Criar';

  getAgentModal()?.show();
}

export async function openEditAgentModal(agentId) {
  if (!canManageUsers(getCurrentUserRole())) {
    showToast('Você não tem permissão para editar atendentes.', 'warning');
    return;
  }

  try {
    const agent = await apiFetch(`/users/${agentId}`);
    if (!agent?.id) {
      showToast('Atendente não encontrado', 'error');
      return;
    }

    resetAgentForm();

    document.getElementById('agentId').value = agent.id;
    document.getElementById('agentName').value = agent.name || '';
    document.getElementById('agentEmail').value = agent.email || '';
    document.getElementById('agentRole').value = agent.role || 'agent';
    document.getElementById('agentStatus').value = agent.status || 'offline';
    populateDepartmentSelect(agent.department || '');
    applyRoleFieldRestrictions();

    const passwordInput = document.getElementById('agentPassword');
    const passwordHint = document.getElementById('agentPasswordHint');
    if (passwordInput) passwordInput.required = false;
    if (passwordHint) passwordHint.style.display = '';

    const title = document.getElementById('agentModalTitle');
    const saveBtn = document.getElementById('saveAgentBtn');
    if (title) title.textContent = 'Editar atendente';
    if (saveBtn) saveBtn.innerHTML = '<i class="bi bi-save"></i> Salvar';

    getAgentModal()?.show();
  } catch (error) {
    showToast(error.message || 'Erro ao carregar atendente', 'error');
  }
}

export async function saveAgent() {
  if (!canManageUsers(getCurrentUserRole())) {
    showToast('Você não tem permissão para gerenciar atendentes.', 'warning');
    return;
  }

  const form = document.getElementById('agentForm');
  if (!form || !form.checkValidity()) {
    form?.reportValidity();
    return;
  }

  const agentId = document.getElementById('agentId')?.value;
  const payload = {
    name: document.getElementById('agentName')?.value?.trim(),
    email: document.getElementById('agentEmail')?.value?.trim(),
    role: document.getElementById('agentRole')?.value,
    status: document.getElementById('agentStatus')?.value,
    department: document.getElementById('agentDepartment')?.value || null
  };

  const password = document.getElementById('agentPassword')?.value;
  if (password) payload.password = password;

  try {
    if (agentId) {
      await apiFetch(`/users/${agentId}`, { method: 'PUT', body: payload });
      showToast('Atendente atualizado com sucesso!', 'success');
    } else {
      if (!password) {
        showToast('Informe uma senha para o novo atendente.', 'warning');
        return;
      }
      await apiFetch('/users', { method: 'POST', body: payload });
      showToast('Atendente criado com sucesso!', 'success');
    }

    getAgentModal()?.hide();
    if (typeof agentsReloadHandler === 'function') {
      await agentsReloadHandler();
    }
  } catch (error) {
    showToast(error.message || 'Erro ao salvar atendente', 'error');
  }
}

export async function deleteAgent(agentId, agentName = '') {
  if (!canManageUsers(getCurrentUserRole())) {
    showToast('Você não tem permissão para excluir atendentes.', 'warning');
    return;
  }

  const label = agentName ? `"${agentName}"` : 'este atendente';
  if (!confirm(`Deseja excluir ${label}? Esta ação não pode ser desfeita.`)) return;

  try {
    await apiFetch(`/users/${agentId}`, { method: 'DELETE' });
    showToast('Atendente excluído com sucesso!', 'success');
    if (typeof agentsReloadHandler === 'function') {
      await agentsReloadHandler();
    }
  } catch (error) {
    showToast(error.message || 'Erro ao excluir atendente', 'error');
  }
}

export function renderAgents({ agents, apiFetch: fetchFn, createToast, escapeHtml: escapeFn, onReload }) {
  agentsReloadHandler = onReload;
  const tbody = document.getElementById('agentsTableBody');
  if (!tbody) return;

  const htmlEscape = escapeFn || escapeHtml;
  const toast = createToast || ((opts) => showToast(opts.message, opts.variant === 'danger' ? 'error' : 'success'));
  const request = fetchFn || apiFetch;

  if (!agents?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum atendente encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = agents.map((u) => {
    const canManage = canManageUsers(getCurrentUserRole());
    const actionButtons = canManage
      ? `
          <button class="btn btn-sm btn-outline-primary" data-action="edit-agent" data-user-id="${htmlEscape(u.id)}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-action="delete-agent" data-user-id="${htmlEscape(u.id)}" data-user-name="${htmlEscape(u.name || '')}" title="Excluir">
            <i class="bi bi-trash"></i>
          </button>
        `
      : '';

    return `
    <tr>
      <td class="fw-semibold">${htmlEscape(u.name || '—')}</td>
      <td class="text-muted">${htmlEscape(u.email || '—')}</td>
      <td>${htmlEscape(getRoleLabel(u.role))}</td>
      <td>
        <span class="badge ${getStatusBadgeClass(u.status)}" data-user-status="${htmlEscape(u.id)}">
          ${htmlEscape(getStatusLabel(u.status))}
        </span>
      </td>
      <td>${htmlEscape(u.department || '—')}</td>
      <td class="text-end">
        <div class="d-inline-flex flex-wrap gap-1 justify-content-end">
          ${actionButtons}
        </div>
      </td>
    </tr>
  `;
  }).join('');

  tbody.querySelectorAll('button[data-action="edit-agent"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openEditAgentModal(btn.getAttribute('data-user-id'));
    });
  });

  tbody.querySelectorAll('button[data-action="delete-agent"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteAgent(btn.getAttribute('data-user-id'), btn.getAttribute('data-user-name'));
    });
  });
}

export function initAgentsModule({ onReload } = {}) {
  agentsReloadHandler = onReload;
  populateDepartmentSelect();

  document.getElementById('newAgentBtn')?.addEventListener('click', openNewAgentModal);
  document.getElementById('saveAgentBtn')?.addEventListener('click', saveAgent);
}
