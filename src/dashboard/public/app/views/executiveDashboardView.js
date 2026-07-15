/**
 * EXECUTIVE DASHBOARD VIEW
 * Dashboard executivo com gráficos e métricas
 */

import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';

let charts = {};
let currentPeriod = {
  startDate: moment().subtract(30, 'days').format('YYYY-MM-DD'),
  endDate: moment().format('YYYY-MM-DD'),
};

/**
 * Inicializa a view do dashboard executivo
 */
export async function initExecutiveDashboardView() {
  console.log('📊 Inicializando Executive Dashboard View...');
  
  initDateFields();
  setupEventListeners();
  await loadDashboardData();
  
  console.log('✅ Executive Dashboard View inicializado');
}

function initDateFields() {
  const startEl = document.getElementById('dashboardStartDate');
  const endEl = document.getElementById('dashboardEndDate');
  if (startEl) startEl.value = currentPeriod.startDate;
  if (endEl) endEl.value = currentPeriod.endDate;
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
  // Filtros de período
  document.getElementById('dashboardStartDate')?.addEventListener('change', handlePeriodChange);
  document.getElementById('dashboardEndDate')?.addEventListener('change', handlePeriodChange);
  
  // Botões de período rápido
  document.getElementById('period7days')?.addEventListener('click', () => setQuickPeriod(7));
  document.getElementById('period30days')?.addEventListener('click', () => setQuickPeriod(30));
  document.getElementById('period90days')?.addEventListener('click', () => setQuickPeriod(90));
  
  // Botão de atualizar
  document.getElementById('refreshDashboard')?.addEventListener('click', loadDashboardData);
  
  // Botão de exportar
  document.getElementById('exportDashboard')?.addEventListener('click', exportDashboard);
}

/**
 * Define período rápido
 */
function setQuickPeriod(days) {
  currentPeriod.startDate = moment().subtract(days, 'days').format('YYYY-MM-DD');
  currentPeriod.endDate = moment().format('YYYY-MM-DD');
  
  document.getElementById('dashboardStartDate').value = currentPeriod.startDate;
  document.getElementById('dashboardEndDate').value = currentPeriod.endDate;
  
  loadDashboardData();
}

/**
 * Handler de mudança de período
 */
function handlePeriodChange() {
  const startDate = document.getElementById('dashboardStartDate')?.value;
  const endDate = document.getElementById('dashboardEndDate')?.value;
  
  if (startDate && endDate) {
    currentPeriod.startDate = startDate;
    currentPeriod.endDate = endDate;
    loadDashboardData();
  }
}

/**
 * Carrega dados do dashboard
 */
async function loadDashboardData() {
  try {
    showLoading();
    
    // Carregar dados em paralelo
    const [kpis, executive, heatmap, performance] = await Promise.all([
      loadKPIs(),
      loadExecutiveData(),
      loadHeatmap(),
      loadPerformance()
    ]);
    
    // Renderizar KPIs
    renderKPIs(kpis);
    renderSummary(executive);
    renderInsights(heatmap);
    renderCharts(executive, heatmap, performance);
    
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    showToast('Erro ao carregar dashboard', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Carrega KPIs
 */
async function loadKPIs() {
  try {
    const response = await apiFetch('/dashboard/kpis', {
      params: currentPeriod
    });
    return response;
  } catch (error) {
    console.error('Erro ao carregar KPIs:', error);
    return null;
  }
}

/**
 * Carrega dados executivos
 */
async function loadExecutiveData() {
  try {
    const response = await apiFetch('/dashboard/executive', {
      params: currentPeriod
    });
    return response;
  } catch (error) {
    console.error('Erro ao carregar dados executivos:', error);
    return { timeline: [], summary: null, trends: null };
  }
}

/**
 * Carrega heatmap
 */
async function loadHeatmap() {
  try {
    const response = await apiFetch('/dashboard/heatmap', {
      params: currentPeriod
    });
    return response;
  } catch (error) {
    console.error('Erro ao carregar heatmap:', error);
    return null;
  }
}

/**
 * Carrega performance
 */
async function loadPerformance() {
  try {
    const response = await apiFetch('/dashboard/performance', {
      params: { ...currentPeriod, type: 'both' }
    });
    return response;
  } catch (error) {
    console.error('Erro ao carregar performance:', error);
    return null;
  }
}

/**
 * Renderiza KPIs
 */
function renderKPIs(data) {
  if (!data?.current) {
    setKPIPlaceholder();
    return;
  }
  
  const { current, variations = {} } = data;
  
  updateKPI('kpiTotalTickets', formatNumber(current.totalTickets), variations.totalTickets);
  updateKPI('kpiAvgResolutionTime', `${Math.round(current.avgResolutionTime || 0)}min`, variations.avgResolutionTime, true);
  updateKPI('kpiNpsScore', Number(current.npsScore || 0).toFixed(1), variations.npsScore);
  updateKPI('kpiConversionRate', `${Number(current.conversionRate || 0).toFixed(1)}%`, variations.conversionRate);
  updateKPI('kpiActiveAgents', formatNumber(current.activeAgents), variations.activeAgents);
}

function setKPIPlaceholder() {
  ['kpiTotalTickets', 'kpiAvgResolutionTime', 'kpiNpsScore', 'kpiConversionRate', 'kpiActiveAgents'].forEach((id) => {
    const valueEl = document.getElementById(`${id}Value`);
    const variationEl = document.getElementById(`${id}Variation`);
    if (valueEl) valueEl.textContent = '—';
    if (variationEl) variationEl.innerHTML = '';
  });
}

function formatNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toLocaleString('pt-BR') : '0';
}

function renderSummary(executive) {
  const panel = document.getElementById('executiveSummary');
  const content = document.getElementById('executiveSummaryContent');
  if (!panel || !content) return;

  const summary = executive?.summary;
  if (!summary) {
    panel.classList.add('d-none');
    return;
  }

  const resolutionRate = summary.totalTickets > 0
    ? ((summary.closedTickets / summary.totalTickets) * 100).toFixed(1)
    : '0.0';

  content.innerHTML = `
    <div class="stat-item">
      <span>Tickets no período</span>
      <span class="stat-value">${formatNumber(summary.totalTickets)}</span>
    </div>
    <div class="stat-item">
      <span>Tickets resolvidos</span>
      <span class="stat-value">${formatNumber(summary.closedTickets)} (${resolutionRate}%)</span>
    </div>
    <div class="stat-item">
      <span>Mensagens processadas</span>
      <span class="stat-value">${formatNumber(summary.totalMessages)}</span>
    </div>
    <div class="stat-item">
      <span>NPS médio</span>
      <span class="stat-value">${Number(summary.avgNPS || 0).toFixed(1)}</span>
    </div>
  `;

  panel.classList.remove('d-none');
}

function renderInsights(heatmap) {
  const container = document.getElementById('heatmapInsights');
  if (!container) return;

  if (!heatmap?.insights) {
    container.innerHTML = '';
    return;
  }

  const { busiestHour, busiestDay } = heatmap.insights;
  const peakHours = (heatmap.peakHours || []).map((h) => `${h}h`).join(', ');

  container.innerHTML = `
    <div class="d-flex flex-wrap gap-2">
      <span class="insight-badge"><i class="bi bi-clock"></i> Pico: ${busiestHour}h</span>
      <span class="insight-badge success"><i class="bi bi-calendar3"></i> Dia mais movimentado: ${busiestDay}</span>
      ${peakHours ? `<span class="insight-badge warning"><i class="bi bi-lightning"></i> Horários de alta demanda: ${peakHours}</span>` : ''}
    </div>
  `;
}

/**
 * Atualiza um KPI
 */
function updateKPI(elementId, value, variation, inverse = false) {
  const valueEl = document.getElementById(`${elementId}Value`);
  const variationEl = document.getElementById(`${elementId}Variation`);
  
  if (valueEl) {
    valueEl.textContent = value;
  }
  
  if (variationEl && variation !== undefined) {
    const isPositive = inverse ? variation < 0 : variation > 0;
    const icon = isPositive ? '▲' : '▼';
    const colorClass = isPositive ? 'text-success' : 'text-danger';
    
    variationEl.innerHTML = `
      <span class="${colorClass}">
        ${icon} ${Math.abs(variation).toFixed(1)}%
      </span>
    `;
  }
}

/**
 * Renderiza todos os gráficos
 */
function renderCharts(executive, heatmap, performance) {
  const timeline = executive?.timeline || [];
  const hasTimeline = timeline.length > 0;

  toggleChartEmpty('ticketsTimelineEmpty', !hasTimeline);

  if (!hasTimeline) {
    destroyChart('timeline');
    destroyChart('messages');
    destroyChart('nps');
  } else {
    renderTimelineChart(timeline);
    renderMessagesChart(timeline);
    renderNPSChart(timeline);
  }

  if (heatmap) {
    renderHourHeatmap(heatmap.byHour || {});
    renderWeekdayChart(heatmap.byWeekday || {});
  }

  if (performance) {
    if (performance.queues) renderQueuesChart(performance.queues);
    if (performance.agents) renderAgentsChart(performance.agents);
  }
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    charts[key] = null;
  }
}

function toggleChartEmpty(elementId, visible) {
  const el = document.getElementById(elementId);
  if (el) el.classList.toggle('d-none', !visible);
}

function getChartCtor() {
  return window.Chart || Chart;
}

/**
 * Gráfico de Timeline de Tickets
 */
function renderTimelineChart(timeline) {
  const ctx = document.getElementById('ticketsTimelineChart');
  if (!ctx) return;
  
  // Destruir gráfico anterior
  if (charts.timeline) {
    charts.timeline.destroy();
  }

  if (!timeline?.length) return;
  
  const dates = timeline.map(t => moment(t.date).format('DD/MM'));
  const totalTickets = timeline.map(t => t.tickets?.total || 0);
  const closedTickets = timeline.map(t => t.tickets?.closed || 0);
  
  charts.timeline = new (getChartCtor())(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Total de Tickets',
          data: totalTickets,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Tickets Fechados',
          data: closedTickets,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Evolução de Tickets'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Gráfico de Mensagens
 */
function renderMessagesChart(timeline) {
  const ctx = document.getElementById('messagesChart');
  if (!ctx) return;
  
  if (charts.messages) {
    charts.messages.destroy();
  }

  if (!timeline?.length) return;
  
  const dates = timeline.map(t => moment(t.date).format('DD/MM'));
  const received = timeline.map(t => t.messages?.received || 0);
  const sent = timeline.map(t => t.messages?.sent || 0);
  
  charts.messages = new (getChartCtor())(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'Recebidas',
          data: received,
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
        },
        {
          label: 'Enviadas',
          data: sent,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Mensagens Recebidas vs Enviadas'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Gráfico de NPS
 */
function renderNPSChart(timeline) {
  const ctx = document.getElementById('npsChart');
  if (!ctx) return;
  
  if (charts.nps) {
    charts.nps.destroy();
  }

  if (!timeline?.length) return;
  
  const dates = timeline.map(t => moment(t.date).format('DD/MM'));
  const npsScores = timeline.map(t => t.satisfaction?.nps || 0);
  
  charts.nps = new (getChartCtor())(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'NPS Score',
        data: npsScores,
        borderColor: 'rgb(255, 205, 86)',
        backgroundColor: 'rgba(255, 205, 86, 0.1)',
        tension: 0.4,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Evolução do NPS'
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          min: -100,
          max: 100
        }
      }
    }
  });
}

/**
 * Heatmap de Horas
 */
function renderHourHeatmap(byHour) {
  const ctx = document.getElementById('hourHeatmapChart');
  if (!ctx) return;
  
  if (charts.hourHeatmap) {
    charts.hourHeatmap.destroy();
  }
  
  const hours = Object.keys(byHour).map(h => `${h}h`);
  const values = Object.values(byHour);
  if (!hours.length) return;
  
  charts.hourHeatmap = new (getChartCtor())(ctx, {
    type: 'bar',
    data: {
      labels: hours,
      datasets: [{
        label: 'Tickets por Hora',
        data: values,
        backgroundColor: values.map(v => {
          const max = Math.max(...values);
          const intensity = v / max;
          return `rgba(255, 99, 132, ${intensity})`;
        }),
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: 'Atividade por Hora do Dia'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Gráfico de Dia da Semana
 */
function renderWeekdayChart(byWeekday) {
  const ctx = document.getElementById('weekdayChart');
  if (!ctx) return;
  
  if (charts.weekday) {
    charts.weekday.destroy();
  }
  
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const values = Object.values(byWeekday);
  if (!values.length) return;
  
  charts.weekday = new (getChartCtor())(ctx, {
    type: 'doughnut',
    data: {
      labels: weekdays,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 205, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
          'rgba(255, 159, 64, 0.7)',
          'rgba(201, 203, 207, 0.7)'
        ],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
        },
        title: {
          display: true,
          text: 'Distribuição por Dia da Semana'
        }
      }
    }
  });
}

/**
 * Gráfico de Filas
 */
function renderQueuesChart(queues) {
  const ctx = document.getElementById('queuesChart');
  if (!ctx) return;
  
  if (charts.queues) {
    charts.queues.destroy();
  }
  
  const labels = Object.keys(queues).map((id) => id === 'sem-fila' || id === 'sem-departamento' ? 'Sem departamento' : id);
  const values = Object.values(queues);
  if (!values.length) return;
  
  charts.queues = new (getChartCtor())(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 205, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(153, 102, 255, 0.7)',
        ],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
        },
        title: {
          display: true,
          text: 'Tickets por Fila'
        }
      }
    }
  });
}

/**
 * Gráfico de Agentes
 */
function renderAgentsChart(agents) {
  const ctx = document.getElementById('agentsChart');
  if (!ctx) return;
  
  if (charts.agents) {
    charts.agents.destroy();
  }
  
  const labels = Object.keys(agents);
  const values = Object.values(agents);
  
  const sorted = labels.map((label, i) => ({ label, value: values[i] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  if (!sorted.length) return;
  
  charts.agents = new (getChartCtor())(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(s => s.label),
      datasets: [{
        label: 'Tickets Atendidos',
        data: sorted.map(s => s.value),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: 'Top 10 Agentes'
        }
      },
      scales: {
        x: {
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * Exporta dados do dashboard
 */
async function exportDashboard() {
  try {
    showLoading();
    
    const response = await apiFetch('/dashboard/executive', {
      params: currentPeriod
    });

    const timeline = response?.data?.timeline || [];
    if (!timeline.length) {
      showToast('Não há dados para exportar no período selecionado.', 'warning');
      return;
    }
    
    const csv = convertToCSV(timeline);
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${currentPeriod.startDate}-${currentPeriod.endDate}.csv`;
    a.click();
    
    showToast('Dashboard exportado com sucesso!', 'success');
  } catch (error) {
    console.error('Erro ao exportar dashboard:', error);
    showToast('Erro ao exportar dashboard', 'error');
  } finally {
    hideLoading();
  }
}

/**
 * Converte dados para CSV
 */
function convertToCSV(timeline) {
  const headers = ['Data', 'Total Tickets', 'Tickets Fechados', 'Mensagens', 'NPS', 'Agentes Ativos'];
  const rows = timeline.map(t => [
    t.date,
    t.tickets.total,
    t.tickets.closed,
    t.messages.total,
    t.satisfaction.nps,
    t.agents.active
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

/**
 * Limpa view
 */
export function cleanupExecutiveDashboardView() {
  // Destruir gráficos
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  charts = {};
}

export default initExecutiveDashboardView;

