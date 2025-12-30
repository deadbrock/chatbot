import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { showLoading, hideLoading } from '../ui/loading.js';

/**
 * View do Editor Visual de Fluxos
 * Implementação simplificada (sem React Flow, usando canvas HTML5)
 */

let currentFlow = null;
let nodesLibrary = [];
let selectedNode = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let canvas = null;
let ctx = null;
let zoom = 1;
let panOffset = { x: 0, y: 0 };

export async function initFlowEditorView() {
  console.log('Inicializando Editor de Fluxos');
  
  // Carregar biblioteca de nodes
  await loadNodesLibrary();
  
  // Configurar canvas
  setupCanvas();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Renderizar sidebar
  renderNodesSidebar();
  
  // Carregar lista de fluxos
  await loadFlowsList();
}

/**
 * Carrega biblioteca de nodes disponíveis
 */
async function loadNodesLibrary() {
  try {
    const response = await apiFetch('/visual-flows/nodes/library');
    nodesLibrary = response.nodes || [];
    console.log(`✅ ${nodesLibrary.length} nodes carregados`);
  } catch (error) {
    console.error('Erro ao carregar biblioteca de nodes:', error);
    showToast('Erro ao carregar biblioteca de nodes', 'error');
  }
}

/**
 * Renderiza sidebar com nodes disponíveis
 */
function renderNodesSidebar() {
  const container = document.getElementById('flowNodesList');
  
  if (!container) {
    console.error('Container flowNodesList não encontrado');
    return;
  }
  
  // Agrupar por categoria
  const grouped = {};
  nodesLibrary.forEach(node => {
    if (!grouped[node.category]) {
      grouped[node.category] = [];
    }
    grouped[node.category].push(node);
  });
  
  let html = '';
  
  for (const [category, nodes] of Object.entries(grouped)) {
    html += `
      <div class="flow-node-category">
        <div class="flow-node-category-title">${getCategoryLabel(category)}</div>
        ${nodes.map(node => `
          <div class="flow-node-item ${node.isBeta ? 'beta' : ''}" 
               data-node-type="${node.type}"
               draggable="true">
            <div class="flow-node-icon" style="background-color: ${node.color}">
              <i class="bi bi-${node.icon}"></i>
            </div>
            <div class="flow-node-info">
              <div class="flow-node-name">${node.name}</div>
              <div class="flow-node-desc">${node.description}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Event listeners para drag
  container.querySelectorAll('.flow-node-item').forEach(item => {
    item.addEventListener('dragstart', handleNodeDragStart);
  });
}

/**
 * Configura canvas
 */
function setupCanvas() {
  canvas = document.getElementById('flowCanvas');
  if (!canvas) {
    console.error('Canvas não encontrado');
    return;
  }
  
  // Ajustar tamanho do canvas
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  ctx = canvas.getContext('2d');
  
  // Desenhar grid inicial
  drawCanvas();
}

function resizeCanvas() {
  if (!canvas) return;
  
  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  
  drawCanvas();
}

/**
 * Desenha o canvas
 */
function drawCanvas() {
  if (!ctx) return;
  
  // Limpar
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Desenhar grid
  ctx.save();
  ctx.translate(panOffset.x, panOffset.y);
  ctx.scale(zoom, zoom);
  
  drawGrid();
  
  // Desenhar nodes
  if (currentFlow && currentFlow.nodes) {
    currentFlow.nodes.forEach(node => drawNode(node));
  }
  
  // Desenhar edges
  if (currentFlow && currentFlow.edges) {
    currentFlow.edges.forEach(edge => drawEdge(edge));
  }
  
  ctx.restore();
}

function drawGrid() {
  const gridSize = 20;
  const width = canvas.width / zoom;
  const height = canvas.height / zoom;
  
  ctx.strokeStyle = '#e9ecef';
  ctx.lineWidth = 1 / zoom;
  
  // Linhas verticais
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Linhas horizontais
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawNode(node) {
  const x = node.position.x;
  const y = node.position.y;
  const width = 180;
  const height = 80;
  
  // Encontrar definição do node
  const nodeDef = nodesLibrary.find(n => n.type === node.type);
  if (!nodeDef) return;
  
  // Sombra
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;
  
  // Fundo
  ctx.fillStyle = 'white';
  ctx.fillRect(x, y, width, height);
  
  // Borda
  ctx.strokeStyle = selectedNode === node.id ? '#667eea' : '#dee2e6';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  
  ctx.shadowColor = 'transparent';
  
  // Header
  ctx.fillStyle = nodeDef.color;
  ctx.fillRect(x, y, width, 30);
  
  // Ícone
  ctx.fillStyle = 'white';
  ctx.font = '16px "Bootstrap Icons"';
  ctx.fillText('', x + 10, y + 20);
  
  // Label
  ctx.fillStyle = 'white';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(nodeDef.name, x + 35, y + 20);
  
  // Body
  ctx.fillStyle = '#6c757d';
  ctx.font = '11px Arial';
  if (node.data && node.data.label) {
    ctx.fillText(node.data.label, x + 10, y + 50);
  }
}

function drawEdge(edge) {
  // Encontrar nodes de origem e destino
  const sourceNode = currentFlow.nodes.find(n => n.id === edge.source);
  const targetNode = currentFlow.nodes.find(n => n.id === edge.target);
  
  if (!sourceNode || !targetNode) return;
  
  const sx = sourceNode.position.x + 90;
  const sy = sourceNode.position.y + 80;
  const tx = targetNode.position.x + 90;
  const ty = targetNode.position.y;
  
  // Desenhar linha
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  
  // Curva bezier
  const cp1x = sx;
  const cp1y = sy + (ty - sy) / 2;
  const cp2x = tx;
  const cp2y = ty - (ty - sy) / 2;
  
  ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
  ctx.stroke();
  
  // Seta
  const angle = Math.atan2(ty - cp2y, tx - cp2x);
  ctx.fillStyle = '#667eea';
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 10 * Math.cos(angle - Math.PI / 6), ty - 10 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tx - 10 * Math.cos(angle + Math.PI / 6), ty - 10 * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

/**
 * Event listeners
 */
function setupEventListeners() {
  if (!canvas) return;
  
  // Mouse events no canvas
  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('wheel', handleCanvasWheel);
  
  // Drop no canvas
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', handleCanvasDrop);
  
  // Toolbar buttons
  document.getElementById('flowSaveBtn')?.addEventListener('click', saveFlow);
  document.getElementById('flowValidateBtn')?.addEventListener('click', validateFlow);
  document.getElementById('flowTestBtn')?.addEventListener('click', testFlow);
  document.getElementById('flowExportBtn')?.addEventListener('click', exportFlow);
  
  // Zoom controls
  document.getElementById('flowZoomInBtn')?.addEventListener('click', () => setZoom(zoom + 0.1));
  document.getElementById('flowZoomOutBtn')?.addEventListener('click', () => setZoom(zoom - 0.1));
  document.getElementById('flowZoomResetBtn')?.addEventListener('click', () => setZoom(1));
}

function handleNodeDragStart(e) {
  e.dataTransfer.setData('nodeType', e.currentTarget.dataset.nodeType);
}

function handleCanvasDrop(e) {
  e.preventDefault();
  
  const nodeType = e.dataTransfer.getData('nodeType');
  if (!nodeType) return;
  
  // Calcular posição no canvas
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - panOffset.x) / zoom;
  const y = (e.clientY - rect.top - panOffset.y) / zoom;
  
  addNodeToFlow(nodeType, x, y);
}

function addNodeToFlow(nodeType, x, y) {
  if (!currentFlow) {
    showToast('Crie ou carregue um fluxo primeiro', 'warning');
    return;
  }
  
  const nodeDef = nodesLibrary.find(n => n.type === nodeType);
  if (!nodeDef) return;
  
  const newNode = {
    id: `node_${Date.now()}`,
    type: nodeType,
    position: { x: Math.round(x / 20) * 20, y: Math.round(y / 20) * 20 },
    data: {
      label: nodeDef.name,
      config: {}
    }
  };
  
  currentFlow.nodes.push(newNode);
  drawCanvas();
  
  showToast(`Node "${nodeDef.name}" adicionado`, 'success');
}

function handleCanvasMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - panOffset.x) / zoom;
  const y = (e.clientY - rect.top - panOffset.y) / zoom;
  
  // Verificar se clicou em um node
  if (currentFlow && currentFlow.nodes) {
    for (let i = currentFlow.nodes.length - 1; i >= 0; i--) {
      const node = currentFlow.nodes[i];
      if (x >= node.position.x && x <= node.position.x + 180 &&
          y >= node.position.y && y <= node.position.y + 80) {
        selectedNode = node.id;
        isDragging = true;
        dragOffset = {
          x: x - node.position.x,
          y: y - node.position.y
        };
        drawCanvas();
        return;
      }
    }
  }
  
  // Clicou no vazio
  selectedNode = null;
  drawCanvas();
}

function handleCanvasMouseMove(e) {
  if (!isDragging || !selectedNode) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - panOffset.x) / zoom;
  const y = (e.clientY - rect.top - panOffset.y) / zoom;
  
  const node = currentFlow.nodes.find(n => n.id === selectedNode);
  if (node) {
    node.position.x = Math.round((x - dragOffset.x) / 20) * 20;
    node.position.y = Math.round((y - dragOffset.y) / 20) * 20;
    drawCanvas();
  }
}

function handleCanvasMouseUp() {
  isDragging = false;
}

function handleCanvasWheel(e) {
  e.preventDefault();
  
  const delta = e.deltaY > 0 ? -0.05 : 0.05;
  setZoom(zoom + delta);
}

function setZoom(newZoom) {
  zoom = Math.max(0.5, Math.min(2, newZoom));
  drawCanvas();
  
  const zoomLevel = document.getElementById('flowZoomLevel');
  if (zoomLevel) {
    zoomLevel.textContent = `${Math.round(zoom * 100)}%`;
  }
}

/**
 * Carrega lista de fluxos
 */
async function loadFlowsList() {
  try {
    const response = await apiFetch('/visual-flows?limit=10');
    const flows = response.flows || [];
    
    renderFlowsList(flows);
  } catch (error) {
    console.error('Erro ao carregar fluxos:', error);
  }
}

function renderFlowsList(flows) {
  const container = document.getElementById('flowsList');
  if (!container) return;
  
  if (flows.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">Nenhum fluxo encontrado</p>';
    return;
  }
  
  container.innerHTML = flows.map(flow => `
    <div class="list-group-item list-group-item-action" onclick="window.loadFlow('${flow.id}')">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <h6 class="mb-1">${flow.name}</h6>
          <small class="text-muted">${flow.type}</small>
        </div>
        <span class="badge bg-${getStatusColor(flow.status)}">${flow.status}</span>
      </div>
    </div>
  `).join('');
}

/**
 * Carrega um fluxo
 */
window.loadFlow = async function(flowId) {
  try {
    showLoading('Carregando fluxo...');
    
    const response = await apiFetch(`/visual-flows/${flowId}`);
    currentFlow = response.flow;
    
    drawCanvas();
    hideLoading();
    
    showToast(`Fluxo "${currentFlow.name}" carregado`, 'success');
  } catch (error) {
    console.error('Erro ao carregar fluxo:', error);
    showToast('Erro ao carregar fluxo', 'error');
    hideLoading();
  }
};

/**
 * Salva o fluxo atual
 */
async function saveFlow() {
  if (!currentFlow) {
    showToast('Nenhum fluxo para salvar', 'warning');
    return;
  }
  
  try {
    showLoading('Salvando fluxo...');
    
    await apiFetch(`/visual-flows/${currentFlow.id}`, {
      method: 'PUT',
      body: {
        nodes: currentFlow.nodes,
        edges: currentFlow.edges,
        canvas: {
          zoom,
          pan: panOffset
        }
      }
    });
    
    hideLoading();
    showToast('Fluxo salvo com sucesso', 'success');
  } catch (error) {
    console.error('Erro ao salvar fluxo:', error);
    showToast('Erro ao salvar fluxo', 'error');
    hideLoading();
  }
}

/**
 * Valida o fluxo atual
 */
async function validateFlow() {
  if (!currentFlow) return;
  
  try {
    const response = await apiFetch(`/visual-flows/${currentFlow.id}/validate`, {
      method: 'POST'
    });
    
    const { validation } = response;
    
    if (validation.isValid) {
      showToast('✅ Fluxo válido!', 'success');
    } else {
      showToast(`⚠️ ${validation.errors.length} erro(s) encontrado(s)`, 'warning');
      console.log('Erros:', validation.errors);
    }
  } catch (error) {
    console.error('Erro ao validar fluxo:', error);
    showToast('Erro ao validar fluxo', 'error');
  }
}

/**
 * Testa o fluxo atual
 */
async function testFlow() {
  if (!currentFlow) return;
  
  try {
    showLoading('Testando fluxo...');
    
    const response = await apiFetch(`/visual-flows/${currentFlow.id}/test`, {
      method: 'POST',
      body: { input: {} }
    });
    
    hideLoading();
    showToast('Teste concluído com sucesso', 'success');
    console.log('Resultado:', response.result);
  } catch (error) {
    console.error('Erro ao testar fluxo:', error);
    showToast('Erro ao testar fluxo', 'error');
    hideLoading();
  }
}

/**
 * Exporta o fluxo atual
 */
async function exportFlow() {
  if (!currentFlow) return;
  
  try {
    window.location.href = `/api/visual-flows/${currentFlow.id}/export`;
    showToast('Fluxo exportado', 'success');
  } catch (error) {
    console.error('Erro ao exportar fluxo:', error);
    showToast('Erro ao exportar fluxo', 'error');
  }
}

// Helpers
function getCategoryLabel(category) {
  const labels = {
    trigger: 'Gatilhos',
    message: 'Mensagens',
    action: 'Ações',
    condition: 'Condições',
    integration: 'Integrações',
    data: 'Dados',
    utility: 'Utilidades',
    ai: 'Inteligência Artificial',
    custom: 'Personalizado'
  };
  return labels[category] || category;
}

function getStatusColor(status) {
  const colors = {
    draft: 'secondary',
    testing: 'warning',
    active: 'success',
    paused: 'info',
    archived: 'dark'
  };
  return colors[status] || 'secondary';
}

