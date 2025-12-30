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
  
  // Setup event listeners
  setupEventListeners();
  
  // Carregar dados iniciais
  await loadDashboardData();
  
  console.log('✅ Executive Dashboard View inicializado');
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
    
    // Renderizar gráficos
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
    return response.data;
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
    return response.data;
  } catch (error) {
    console.error('Erro ao carregar dados executivos:', error);
    return null;
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
    return response.data;
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
    return response.data;
  } catch (error) {
    console.error('Erro ao carregar performance:', error);
    return null;
  }
}

/**
 * Renderiza KPIs
 */
function renderKPIs(data) {
  if (!data) return;
  
  const { current, previous, variations } = data;
  
  // Total Tickets
  updateKPI('kpiTotalTickets', current.totalTickets, variations.totalTickets);
  
  // Tempo Médio de Resolução
  updateKPI('kpiAvgResolutionTime', `${current.avgResolutionTime}min`, variations.avgResolutionTime, true);
  
  // NPS Score
  updateKPI('kpiNpsScore', current.npsScore.toFixed(1), variations.npsScore);
  
  // Taxa de Conversão
  updateKPI('kpiConversionRate', `${current.conversionRate.toFixed(1)}%`, variations.conversionRate);
  
  // Agentes Ativos
  updateKPI('kpiActiveAgents', current.activeAgents, variations.activeAgents);
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
  if (!executive) return;
  
  // Gráfico de Timeline (Tickets)
  renderTimelineChart(executive.timeline);
  
  // Gráfico de Mensagens
  renderMessagesChart(executive.timeline);
  
  // Gráfico de NPS
  renderNPSChart(executive.timeline);
  
  // Heatmap de Hora
  if (heatmap) {
    renderHourHeatmap(heatmap.byHour);
    renderWeekdayChart(heatmap.byWeekday);
  }
  
  // Performance
  if (performance) {
    if (performance.queues) {
      renderQueuesChart(performance.queues);
    }
    if (performance.agents) {
      renderAgentsChart(performance.agents);
    }
  }
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
  
  const dates = timeline.map(t => moment(t.date).format('DD/MM'));
  const totalTickets = timeline.map(t => t.tickets.total);
  const closedTickets = timeline.map(t => t.tickets.closed);
  
  charts.timeline = new Chart(ctx, {
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
  
  const dates = timeline.map(t => moment(t.date).format('DD/MM'));
  const received = timeline.map(t => t.messages.received);
  const sent = timeline.map(t => t.messages.sent);
  
  charts.messages = new Chart(ctx, {
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
  
  const dates = timeline.map(t => moment(t.date).format('DD/MM'));
  const npsScores = timeline.map(t => t.satisfaction.nps);
  
  charts.nps = new Chart(ctx, {
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
  
  charts.hourHeatmap = new Chart(ctx, {
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
  
  charts.weekday = new Chart(ctx, {
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
  
  const labels = Object.keys(queues).map(id => id === 'sem-fila' ? 'Sem Fila' : `Fila ${id.substring(0, 8)}`);
  const values = Object.values(queues);
  
  charts.queues = new Chart(ctx, {
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
  
  const labels = Object.keys(agents).map(id => id === 'sem-agente' ? 'Sem Agente' : `Agente ${id.substring(0, 8)}`);
  const values = Object.values(agents);
  
  // Ordenar por valor (decrescente)
  const sorted = labels.map((label, i) => ({ label, value: values[i] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10
  
  charts.agents = new Chart(ctx, {
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
    
    // Converter para CSV
    const csv = convertToCSV(response.data.timeline);
    
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

