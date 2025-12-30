export function renderAgents({ agents, apiFetch, createToast, escapeHtml }) {
  const tbody = document.getElementById('agentsTableBody');
  if (!tbody) return;

  if (!agents?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = agents.map((u) => `
    <tr>
      <td class="fw-semibold">${escapeHtml(u.name || '—')}</td>
      <td class="text-muted">${escapeHtml(u.email || '—')}</td>
      <td>${escapeHtml(u.role || '—')}</td>
      <td>${escapeHtml(u.status || 'offline')}</td>
      <td>${escapeHtml(u.department || '—')}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" data-user-id="${escapeHtml(u.id)}" data-status="online">Online</button>
        <button class="btn btn-sm btn-outline-secondary" data-user-id="${escapeHtml(u.id)}" data-status="offline">Offline</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-user-id][data-status]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-user-id');
      const status = btn.getAttribute('data-status');
      try {
        await apiFetch(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
        createToast({ title: 'Ok', message: 'Status atualizado.', variant: 'success' });
      } catch (e) {
        createToast({ title: 'Erro', message: e?.message || 'Falha ao atualizar status.', variant: 'danger' });
      }
    });
  });
}


