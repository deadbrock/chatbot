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
  'tags',
  'schedules',
  'administration',
  'ai-playground',
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
    canManageUsers: true
  },
  manager: {
    sections: ALL_SECTIONS,
    canManageUsers: true
  },
  agent: {
    sections: AGENT_SECTIONS,
    canManageUsers: false
  },
  viewer: {
    sections: AGENT_SECTIONS,
    canManageUsers: false
  }
};

function normalizeRole(role) {
  return ROLE_CONFIG[role] ? role : 'agent';
}

function canAccessSection(role, section) {
  const config = ROLE_CONFIG[normalizeRole(role)];
  if (!section) return false;
  return config.sections.includes(section);
}

function canManageUsers(role) {
  return Boolean(ROLE_CONFIG[normalizeRole(role)]?.canManageUsers);
}

function getDefaultSection(role) {
  const config = ROLE_CONFIG[normalizeRole(role)];
  return config.sections[0] || 'dashboard';
}

module.exports = {
  ALL_SECTIONS,
  AGENT_SECTIONS,
  ROLE_CONFIG,
  normalizeRole,
  canAccessSection,
  canManageUsers,
  getDefaultSection
};
