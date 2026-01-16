function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function formatStatus(status) {
  const map = {
    open: 'Aberto',
    waiting_human: 'Aguardando humano',
    in_progress: 'Em progresso',
    resolved: 'Resolvido',
    closed: 'Fechado'
  };
  return map[status] || status || '—';
}

export async function openTicketModal({ ticketId, apiFetch, createToast, escapeHtml }) {
  try {
    const ticket = await apiFetch(`/tickets/${ticketId}`);

    const modalEl = document.getElementById('ticketModal');
    modalEl.dataset.ticketId = ticket.id;

    document.getElementById('ticketModalProtocol').textContent = ticket.protocol || '';
    document.getElementById('ticketModalUser').textContent = ticket.userName || ticket.userId || '—';
    document.getElementById('ticketModalDept').textContent = ticket.department || '—';
    document.getElementById('ticketModalStatus').value = ticket.status || 'open';
    document.getElementById('ticketModalDesc').textContent = ticket.description || ticket.subject || '—';

    const timeline = document.getElementById('ticketModalTimeline');
    const msgs = ticket.messages || [];
    if (!msgs.length) {
      timeline.innerHTML = `<div class="text-muted">Sem histórico registrado.</div>`;
    } else {
      timeline.innerHTML = msgs.slice().reverse().map((m) => `
        <div class="ticket-event">
          <div class="meta">
            <span>${escapeHtml(m.isBot ? 'Bot' : (m.from || 'Usuário'))}</span>
            <span>${escapeHtml(formatDate(m.timestamp || ticket.createdAt))}</span>
          </div>
          <div class="msg">${escapeHtml(m.message || '')}</div>
        </div>
      `).join('');
    }

    // 🔐 Verificar permissões para transferir ticket
    await loadTransferSection(ticket, apiFetch, createToast);

    const modal = new window.bootstrap.Modal(modalEl);
    modal.show();
  } catch (e) {
    createToast({ title: 'Erro', message: e?.message || 'Não foi possível abrir o ticket.', variant: 'danger' });
  }
}

/**
 * Carrega seção de transferência (apenas para admin/manager)
 */
async function loadTransferSection(ticket, apiFetch, createToast) {
  const transferSection = document.getElementById('ticketTransferSection');
  const transferSelect = document.getElementById('ticketTransferAgent');
  const transferBtn = document.getElementById('ticketTransferBtn');
  
  // Verificar permissão do usuário logado
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
  
  if (!isAdminOrManager) {
    transferSection.style.display = 'none';
    return;
  }
  
  // Mostrar seção
  transferSection.style.display = 'block';
  
  try {
    // Carregar lista de atendentes
    const agents = await apiFetch('/users?role=agent,manager');
    
    transferSelect.innerHTML = '<option value="">Selecione um atendente...</option>';
    agents.forEach(agent => {
      const isCurrentAssigned = agent.id === ticket.assignedTo;
      const option = document.createElement('option');
      option.value = agent.id;
      option.textContent = `${agent.name} (${agent.department || 'Sem departamento'})${isCurrentAssigned ? ' - ATUAL' : ''}`;
      if (isCurrentAssigned) option.disabled = true;
      transferSelect.appendChild(option);
    });
    
    // Adicionar evento de transferência
    transferBtn.onclick = async () => {
      const newAgentId = transferSelect.value;
      if (!newAgentId) {
        createToast({ title: 'Atenção', message: 'Selecione um atendente', variant: 'warning' });
        return;
      }
      
      if (confirm(`Deseja transferir este ticket para outro atendente?`)) {
        try {
          await apiFetch(`/tickets/${ticket.id}/transfer`, {
            method: 'POST',
            body: { agentId: parseInt(newAgentId) }
          });
          
          createToast({ title: 'Sucesso', message: 'Ticket transferido com sucesso!', variant: 'success' });
          
          // Fechar modal e recarregar tickets
          const modal = window.bootstrap.Modal.getInstance(document.getElementById('ticketModal'));
          if (modal) modal.hide();
          
          window.location.reload();
        } catch (error) {
          createToast({ title: 'Erro', message: error?.message || 'Falha ao transferir ticket', variant: 'danger' });
        }
      }
    };
  } catch (error) {
    console.error('Erro ao carregar atendentes:', error);
  }
}

export function renderTickets({ tickets, apiFetch, createToast, escapeHtml }) {
  const tbody = document.getElementById('ticketsTableBody');
  if (!tbody) return;

  const q = (document.getElementById('ticketSearch')?.value || '').trim().toLowerCase();
  const filtered = !q ? tickets : tickets.filter((t) => {
    const hay = `${t.protocol} ${t.userName || ''} ${t.userId || ''} ${t.department || ''}`.toLowerCase();
    return hay.includes(q);
  });

  if (!filtered?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Nenhum ticket encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((t) => `
    <tr>
      <td class="fw-semibold">${escapeHtml(t.protocol)}</td>
      <td>${escapeHtml(t.userName || '—')}</td>
      <td>${escapeHtml(t.department || '—')}</td>
      <td><span class="status-badge status-${escapeHtml(t.status)}">${escapeHtml(formatStatus(t.status))}</span></td>
      <td>${escapeHtml(formatDate(t.updatedAt || t.createdAt))}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" data-ticket-id="${escapeHtml(t.id)}" data-action="open-ticket">
          <i class="bi bi-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-action="open-ticket"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ticketId = btn.getAttribute('data-ticket-id');
      openTicketModal({ ticketId, apiFetch, createToast, escapeHtml });
    });
  });
}


