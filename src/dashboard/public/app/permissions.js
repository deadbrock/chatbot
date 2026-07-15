import { getStoredUser } from './auth.js';

const ALL_SECTIONS = [
  'dashboard',
  'tickets',
  'sessions',
  'chat',
  'agents',
  'contacts',
  'queues',
  'ticketStatuses',
  'analytics',
  'kanban',
  'executive-dashboard',
  'campaigns',
  'tags',
  'schedules',
  'administration',
  'ai-playground',
  'automations',
  'settings'
];

const AGENT_SECTIONS = [
  'dashboard',
  'tickets',
  'sessions',
  'chat',
  'tags',
  'schedules',
  'settings'
];

const ROLE_CONFIG = {
  admin: {
    sections: ALL_SECTIONS,
    canManageUsers: true,
    label: 'Admin'
  },
  manager: {
    sections: ALL_SECTIONS,
    canManageUsers: true,
    label: 'Gestor'
  },
  agent: {
    sections: AGENT_SECTIONS,
    canManageUsers: false,
    label: 'Atendente'
  },
  viewer: {
    sections: AGENT_SECTIONS,
    canManageUsers: false,
    label: 'Leitura'
  }
};

export function normalizeRole(role) {
  return ROLE_CONFIG[role] ? role : 'agent';
}

export function getRoleLabel(role) {
  return ROLE_CONFIG[normalizeRole(role)]?.label || role || 'Atendente';
}

export function canAccessSection(role, section) {
  const config = ROLE_CONFIG[normalizeRole(role)];
  if (!section) return false;
  return config.sections.includes(section);
}

export function canManageUsers(role) {
  return Boolean(ROLE_CONFIG[normalizeRole(role)]?.canManageUsers);
}

export function getDefaultSection(role) {
  const config = ROLE_CONFIG[normalizeRole(role)];
  return config.sections[0] || 'dashboard';
}

export function getCurrentUserRole() {
  return normalizeRole(getStoredUser()?.role);
}

export function applyMenuPermissions(role = getCurrentUserRole()) {
  const normalizedRole = normalizeRole(role);

  document.querySelectorAll('[data-section]').forEach((link) => {
    const section = link.getAttribute('data-section');
    const allowed = canAccessSection(normalizedRole, section);
    const navItem = link.closest('.nav-item');
    if (navItem) {
      navItem.style.display = allowed ? '' : 'none';
    }
  });

  document.querySelectorAll('#sidebar .nav-item.has-submenu').forEach((parent) => {
    const submenuItems = parent.querySelectorAll('.nav-submenu > .nav-item');
    const hasVisibleChild = Array.from(submenuItems).some((item) => item.style.display !== 'none');
    parent.style.display = hasVisibleChild ? '' : 'none';
  });

  document.querySelectorAll('[data-nav-section]').forEach((card) => {
    const section = card.getAttribute('data-nav-section');
    const col = card.closest('[class*="col-"]');
    if (col) {
      col.style.display = canAccessSection(normalizedRole, section) ? '' : 'none';
    }
  });

  const newAgentBtn = document.getElementById('newAgentBtn');
  if (newAgentBtn) {
    newAgentBtn.style.display = canManageUsers(normalizedRole) ? '' : 'none';
  }
}

export function resolveSectionForRole(role, section) {
  const normalizedRole = normalizeRole(role);
  const target = section || getDefaultSection(normalizedRole);
  return canAccessSection(normalizedRole, target)
    ? target
    : getDefaultSection(normalizedRole);
}
