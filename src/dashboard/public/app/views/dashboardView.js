import { setNavBadge } from '../ui/dom.js';

function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

function formatStatus(status) {
  const map = {
    open: 'Aberto',
    waiting_human: 'Aguardando',
    in_progress: 'Em progresso',
    resolved: 'Resolvido',
    closed: 'Fechado'
  };
  return map[status] || status || '—';
}

export function renderDashboard({ data, tickets, extendedMetrics, npsData, escapeHtml }) {
  // Métricas básicas (compatibilidade) - verificar se elementos existem
  const setTextIfExists = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setTextIfExists('ticketsToday', data?.ticketsToday ?? 0);
  setTextIfExists('ticketsOpen', data?.ticketsOpen ?? 0);
  setTextIfExists('sessionsActive', data?.sessionsActive ?? 0);
  setTextIfExists('agentsOnline', data?.agentsOnline ?? 0);

  setNavBadge('ticketsBadge', data?.ticketsOpen ?? 0);
  setNavBadge('sessionsBadge', data?.sessionsActive ?? 0);

  // Métricas estendidas (11 cards) - se disponível
  if (extendedMetrics) {
    renderExtendedMetrics(extendedMetrics);
  }

  // Widget NPS - se disponível
  if (npsData) {
    renderNPSWidget(npsData);
  }

  const tbody = document.getElementById('recentTicketsTable');
  if (!tbody) return;

  if (!tickets?.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum ticket encontrado</td></tr>';
    return;
  }

  tbody.innerHTML = tickets.map((t) => `
    <tr>
      <td><strong>${escapeHtml(t.protocol)}</strong></td>
      <td>${escapeHtml(t.userName || '—')}</td>
      <td>${escapeHtml(t.department || '—')}</td>
      <td><span class="status-badge status-${escapeHtml(t.status)}">${escapeHtml(formatStatus(t.status))}</span></td>
      <td>${escapeHtml(formatDate(t.createdAt))}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" data-ticket-id="${escapeHtml(t.id)}" data-action="open-ticket" aria-label="Abrir ticket">
          <i class="bi bi-eye"></i>
        </button>
      </td>
    </tr>
  `).join('');

  // delegação simples para abrir ticket (evita onclick inline)
  tbody.querySelectorAll('[data-action="open-ticket"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ticketId = btn.getAttribute('data-ticket-id');
      window.dispatchEvent(new CustomEvent('openTicket', { detail: { ticketId } }));
    });
  });
}

/**
 * Renderiza métricas estendidas (11 cards Amanda-style)
 */
function renderExtendedMetrics(metrics) {
  const elements = {
    ticketsAtendimento: 'ticketsAtendimento',
    ticketsAguardando: 'ticketsAguardando',
    ticketsFinalizados: 'ticketsFinalizados',
    msgsRecebidas: 'msgsRecebidas',
    tempoAtendimento: 'tempoAtendimento',
    tempoEspera: 'tempoEspera',
    novosContatos: 'novosContatos',
    atendentesAtivos: 'atendentesAtivos'
  };

  Object.keys(elements).forEach(key => {
    const el = document.getElementById(elements[key]);
    if (el) {
      let value = metrics[key] ?? 0;
      // Formatar tempo em minutos como "Xm"
      if (key === 'tempoAtendimento' || key === 'tempoEspera') {
        value = `${value}m`;
      }
      el.textContent = value;
    }
  });
}

/**
 * Renderiza Widget NPS
 */
function renderNPSWidget(npsData) {
  const npsScore = document.getElementById('npsScore');
  const npsPercent = document.getElementById('npsPercent');
  const npsPromoters = document.getElementById('npsPromoters');
  const npsNeutrals = document.getElementById('npsNeutrals');
  const npsDetractors = document.getElementById('npsDetractors');

  if (npsScore) npsScore.textContent = npsData.nps || 0;
  if (npsPercent) npsPercent.textContent = `${npsData.evaluated || 0} avaliados`;
  if (npsPromoters) npsPromoters.textContent = `${npsData.promotersPercent || 0}%`;
  if (npsNeutrals) npsNeutrals.textContent = `${npsData.neutralsPercent || 0}%`;
  if (npsDetractors) npsDetractors.textContent = `${npsData.detractorsPercent || 0}%`;
}

/**
 * Renderiza ranking de atendentes
 */
export function renderRankings({ agents }) {
  const agentsList = document.getElementById('agentRankingList');
  if (agentsList && agents?.length) {
    agentsList.innerHTML = agents.map((a, idx) => `
      <div class="agent-ranking-item">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="d-flex align-items-center">
            <span class="rank-badge">#${idx + 1}</span>
            <div class="avatar-sm bg-success text-white rounded-circle me-2">
              ${a.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>${a.name}</strong>
              <br><small class="text-muted">${a.email || ''}</small>
            </div>
          </div>
          <div class="text-end">
            <strong class="text-primary">${a.ticketCount}</strong>
            <br><small class="text-muted">tickets</small>
          </div>
        </div>
        <div class="agent-stats d-flex gap-3 small text-muted">
          <span><i class="bi bi-star"></i> ${a.avgRating}</span>
          <span><i class="bi bi-clock"></i> ${a.avgTime}m</span>
        </div>
      </div>
    `).join('');
  }
}

/**
 * Renderiza gráfico de atividade por hora
 */
export async function renderAdditionalCharts({ apiFetch }) {
  if (!window.Chart) return;
  window.__charts = window.__charts || {};

  try {
    const hourlyActivity = await apiFetch('/analytics/activity/hourly').catch(() => null);

    if (hourlyActivity) {
      renderHourlyActivityChart(hourlyActivity);
    }
  } catch (error) {
    console.error('Erro ao renderizar gráficos adicionais:', error);
  }
}

function renderHourlyActivityChart(data) {
  const canvas = document.getElementById('hourlyActivityChart');
  if (!canvas) return;

  window.__charts.hourlyActivity?.destroy?.();

  if (!data || !data.hourly || !Array.isArray(data.hourly)) {
    console.warn('Dados de atividade horária inválidos:', data);
    return;
  }

  const labels = data.hourly.map(h => `${h.hour}h`);
  const values = data.hourly.map(h => h.count);

  window.__charts.hourlyActivity = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tickets',
        data: values,
        backgroundColor: '#3F51B5'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });

  // Atualizar badge de pico
  const peakEl = document.getElementById('peakHour');
  if (peakEl && data.peak) {
    peakEl.textContent = `Pico: ${data.peak}`;
  }
}

export function renderDashboardCharts({ timelineRows, statusRows }) {
  if (!window.Chart) return;
  window.__charts = window.__charts || {};

  const setEmptyVisible = (id, visible) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('is-hidden', !visible);
  };

  // Timeline
  const timelineEl = document.getElementById('ticketsChart');
  if (timelineEl) {
    window.__charts.dashboardTimeline?.destroy?.();
    const timelineData = Array.isArray(timelineRows) ? timelineRows : [];
    const labels = timelineData.map((r) => r._id || r.date || r.label || '');
    const values = timelineData.map((r) => Number(r.count || r.value || 0));

    const hasData = labels.length > 0 && values.some((v) => v > 0);
    setEmptyVisible('ticketsChartEmpty', !hasData);

    if (!hasData) {
      return;
    }

    window.__charts.dashboardTimeline = new window.Chart(timelineEl, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Tickets',
          data: values,
          tension: 0.25,
          borderColor: 'rgba(13,110,253,0.90)',
          backgroundColor: 'rgba(13,110,253,0.12)',
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  // Status
  const statusEl = document.getElementById('statusChart');
  if (statusEl) {
    window.__charts.dashboardStatus?.destroy?.();
    const labels = (statusRows || []).map((r) => formatStatus(r._id));
    const values = (statusRows || []).map((r) => Number(r.count || 0));

    const hasData = labels.length > 0 && values.some((v) => v > 0);
    setEmptyVisible('statusChartEmpty', !hasData);

    if (!hasData) {
      return;
    }

    window.__charts.dashboardStatus = new window.Chart(statusEl, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#0d6efd', '#20c997', '#ffc107', '#fd7e14', '#dc3545'],
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}


