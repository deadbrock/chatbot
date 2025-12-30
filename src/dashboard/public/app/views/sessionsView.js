function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

export function renderSessions({ sessions, apiFetch, createToast, escapeHtml }) {
  const tbody = document.getElementById('sessionsTableBody');
  if (!tbody) return;

  if (!sessions?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhuma sessão ativa.</td></tr>`;
    return;
  }

  tbody.innerHTML = sessions.map((s) => `
    <tr>
      <td class="text-muted">${escapeHtml(s.userId)}</td>
      <td class="fw-semibold">${escapeHtml(s.userName || '—')}</td>
      <td>${escapeHtml(s.currentDepartment || '—')}</td>
      <td>${escapeHtml(String(s.interactionCount ?? 0))}</td>
      <td>${escapeHtml(formatDate(s.lastInteraction || s.updatedAt || s.createdAt))}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger" data-user-id="${escapeHtml(s.userId)}" data-action="expire-session">
          <i class="bi bi-x-circle"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-action="expire-session"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = btn.getAttribute('data-user-id');
      if (!confirm('Deseja expirar esta sessão?')) return;
      try {
        await apiFetch(`/sessions/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        createToast({ title: 'Ok', message: 'Sessão expirada.', variant: 'success' });
        // recarregar após expirar
        const refreshed = await apiFetch('/sessions');
        renderSessions({ sessions: refreshed, apiFetch, createToast, escapeHtml });
      } catch (e) {
        createToast({ title: 'Erro', message: e?.message || 'Falha ao expirar sessão.', variant: 'danger' });
      }
    });
  });
}


