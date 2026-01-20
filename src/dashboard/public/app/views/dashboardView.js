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
  setTextIfExists('ticketsBadge', data?.ticketsOpen ?? 0);
  setTextIfExists('sessionsBadge', data?.sessionsActive ?? 0);

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
    ticketsAtivos: 'ticketsAtivos',
    ticketsPassivos: 'ticketsPassivos',
    ticketsAtendimento: 'ticketsAtendimento',
    ticketsAguardando: 'ticketsAguardando',
    ticketsFinalizados: 'ticketsFinalizados',
    msgsRecebidas: 'msgsRecebidas',
    msgsEnviadas: 'msgsEnviadas',
    tempoAtendimento: 'tempoAtendimento',
    tempoEspera: 'tempoEspera',
    ticketsPorDia: 'ticketsPorDia',
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
 * Renderiza Rankings
 */
export function renderRankings({ contacts, agents }) {
  // Ranking de Contatos
  const contactsTable = document.getElementById('rankingContatos');
  if (contactsTable && contacts?.length) {
    contactsTable.innerHTML = contacts.map((c, idx) => `
      <tr>
        <td>
          <div class="d-flex align-items-center">
            <div class="avatar-sm bg-primary text-white rounded-circle me-2">
              ${c.name.substring(0, 2).toUpperCase()}
            </div>
            <span>${c.name}</span>
          </div>
        </td>
        <td class="text-center">
          <span class="badge bg-info">${c.ticketCount}</span>
        </td>
        <td>
          <small class="text-muted"><i class="bi bi-building"></i> ${c.department}</small>
        </td>
        <td class="text-end">
          <small class="text-muted"><i class="bi bi-clock"></i> ${c.totalTime}m</small>
        </td>
      </tr>
    `).join('');
  }

  // Ranking de Atendentes (lista)
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
 * Renderiza gráficos adicionais (Tempo, Hora, Distribuição)
 */
export async function renderAdditionalCharts({ apiFetch }) {
  if (!window.Chart) return;
  window.__charts = window.__charts || {};

  try {
    // Carregar dados dos novos gráficos
    const [timeMetrics, hourlyActivity, channelDist, deptDist] = await Promise.all([
      apiFetch('/analytics/metrics/time').catch(() => null),
      apiFetch('/analytics/activity/hourly').catch(() => null),
      apiFetch('/analytics/distribution/channel').catch(() => null),
      apiFetch('/analytics/distribution/department').catch(() => null)
    ]);

    // Gráfico de Métricas de Tempo
    if (timeMetrics) {
      renderTimeMetricsChart(timeMetrics);
    }

    // Gráfico de Atividade por Hora
    if (hourlyActivity) {
      renderHourlyActivityChart(hourlyActivity);
    }

    // Gráficos de Distribuição
    if (channelDist) {
      renderChannelDistributionChart(channelDist);
    }

    if (deptDist) {
      renderDepartmentDistributionChart(deptDist);
    }

  } catch (error) {
    console.error('Erro ao renderizar gráficos adicionais:', error);
  }
}

function renderTimeMetricsChart(data) {
  const canvas = document.getElementById('timeMetricsChart');
  if (!canvas) return;

  window.__charts.timeMetrics?.destroy?.();

  if (!data || typeof data.total !== 'number') {
    console.warn('Dados de métricas de tempo inválidos:', data);
    return;
  }

  const hasData = data.total > 0;
  const emptyEl = document.getElementById('timeMetricsEmpty');
  if (emptyEl) emptyEl.classList.toggle('is-hidden', hasData);

  if (!hasData) return;

  window.__charts.timeMetrics = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Atendimento', 'Espera', 'Primeira Resposta'],
      datasets: [{
        label: 'Minutos',
        data: [data.tempoAtendimento, data.tempoEspera, data.tempoPrimeiraResposta],
        backgroundColor: ['#FF9800', '#C2185B', '#2196F3']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => v + 'm' } } }
    }
  });
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

function renderChannelDistributionChart(data) {
  const canvas = document.getElementById('channelDistChart');
  if (!canvas) return;

  window.__charts.channelDist?.destroy?.();

  if (!data || !data.channels || !Array.isArray(data.channels)) {
    console.warn('Dados de distribuição por canal inválidos:', data);
    return;
  }

  const labels = data.channels.map(c => c.channel);
  const values = data.channels.map(c => c.count);
  const colors = ['#25D366', '#0088cc', '#E1306C', '#1877F2'];

  window.__charts.channelDist = new window.Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length)
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  const totalEl = document.getElementById('totalCanais');
  if (totalEl) totalEl.textContent = `${data.totalChannels} canais`;
}

function renderDepartmentDistributionChart(data) {
  const canvas = document.getElementById('sectorDistChart');
  if (!canvas) return;

  window.__charts.deptDist?.destroy?.();

  if (!data || !data.departments || !Array.isArray(data.departments)) {
    console.warn('Dados de distribuição por departamento inválidos:', data);
    return;
  }

  const labels = data.departments.map(d => d.department);
  const values = data.departments.map(d => d.count);

  window.__charts.deptDist = new window.Chart(canvas, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
          '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' }
      }
    }
  });

  const totalEl = document.getElementById('totalSetores');
  if (totalEl) totalEl.textContent = `${data.totalDepartments} setores`;
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


