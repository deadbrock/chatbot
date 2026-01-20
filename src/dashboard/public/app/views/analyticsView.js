function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function renderAnalytics({ byDept, ratings, perf, createToast, escapeHtml }) {
  try {
    renderByDeptChart(byDept || []);
    renderRatingsChart(ratings || []);
    renderAgentsPerf(perf || [], escapeHtml);
  } catch (e) {
    createToast({ title: 'Erro', message: e?.message || 'Falha ao renderizar analytics.', variant: 'danger' });
  }
}

function renderByDeptChart(rows) {
  const el = document.getElementById('byDepartmentChart');
  if (!el || !window.Chart) return;
  if (window.__charts?.byDept) window.__charts.byDept.destroy();
  window.__charts = window.__charts || {};

  // Normalizar rows para array
  const normalizedRows = Array.isArray(rows) ? rows : [];
  
  if (normalizedRows.length === 0) {
    console.warn('Sem dados para gráfico de departamentos');
    return;
  }

  const labels = normalizedRows.map((r) => r._id || '—');
  const values = normalizedRows.map((r) => toNumber(r.count));

  window.__charts.byDept = new window.Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tickets',
        data: values,
        backgroundColor: 'rgba(13,110,253,0.35)',
        borderColor: 'rgba(13,110,253,0.85)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function renderRatingsChart(rows) {
  const el = document.getElementById('ratingsChart');
  if (!el || !window.Chart) return;
  if (window.__charts?.ratings) window.__charts.ratings.destroy();
  window.__charts = window.__charts || {};

  // Normalizar rows para array
  const normalizedRows = Array.isArray(rows) ? rows : [];
  
  if (normalizedRows.length === 0) {
    console.warn('Sem dados para gráfico de avaliações');
    return;
  }

  const labels = normalizedRows.map((r) => `${r._id}★`);
  const values = normalizedRows.map((r) => toNumber(r.count));

  window.__charts.ratings = new window.Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#198754'],
        borderColor: '#fff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderAgentsPerf(rows, escapeHtml) {
  const tbody = document.getElementById('agentsPerfTableBody');
  if (!tbody) return;

  // Normalizar rows para array
  const normalizedRows = Array.isArray(rows) ? rows : [];

  if (!normalizedRows.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Sem dados.</td></tr>`;
    return;
  }

  tbody.innerHTML = normalizedRows.map((r) => `
    <tr>
      <td class="fw-semibold">${escapeHtml(r.agentName || '—')}</td>
      <td>${escapeHtml(String(r.totalTickets ?? 0))}</td>
      <td>${escapeHtml(String(r.resolved ?? 0))}</td>
      <td>${escapeHtml(toNumber(r.avgRating).toFixed(2))}</td>
    </tr>
  `).join('');
}


