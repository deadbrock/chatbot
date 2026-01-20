import { apiFetch } from '../api.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../ui/dom.js';

let currentTab = 'flows';

export async function loadSettingsView() {
  console.log('Carregando Configurações...');
  
  // Renderizar tabs
  renderSettingsTabs();
  
  // Carregar aba inicial
  await loadFlowsTab();
}

function renderSettingsTabs() {
  const container = document.getElementById('settingsContent');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-container">
      <!-- Tabs Navigation -->
      <ul class="nav nav-tabs mb-4" id="settingsTabs" role="tablist">
        <li class="nav-item" role="presentation">
          <button class="nav-link active" id="flows-tab" data-tab="flows">
            <i class="bi bi-diagram-3"></i> Fluxos de Conversa
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="bot-flows-tab" data-tab="bot-flows">
            <i class="bi bi-bezier2"></i> Editor do Fluxo (Bot)
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="ai-tab" data-tab="ai">
            <i class="bi bi-robot"></i> IA Inteligente
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="templates-tab" data-tab="templates">
            <i class="bi bi-chat-left-text"></i> Templates de Mensagens
          </button>
        </li>
        <li class="nav-item" role="presentation">
          <button class="nav-link" id="general-tab" data-tab="general">
            <i class="bi bi-gear"></i> Configurações Gerais
          </button>
        </li>
      </ul>

      <!-- Tab Content -->
      <div class="tab-content" id="settingsTabContent">
        <div class="tab-pane fade show active" id="flows-content"></div>
        <div class="tab-pane fade" id="bot-flows-content"></div>
        <div class="tab-pane fade" id="ai-content"></div>
        <div class="tab-pane fade" id="templates-content"></div>
        <div class="tab-pane fade" id="general-content"></div>
      </div>
    </div>
  `;

  // Event listeners para tabs
  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', async (e) => {
      const tabName = e.currentTarget.dataset.tab;
      switchTab(tabName);
    });
  });
}

async function switchTab(tabName) {
  currentTab = tabName;

  // Atualizar tabs visuais
  document.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('show', 'active');
  });
  document.getElementById(`${tabName}-content`).classList.add('show', 'active');

  // Carregar conteúdo
  switch (tabName) {
    case 'flows':
      await loadFlowsTab();
      break;
    case 'bot-flows':
      await loadBotFlowsTab();
      break;
    case 'ai':
      await loadAITab();
      break;
    case 'templates':
      await loadTemplatesTab();
      break;
    case 'general':
      await loadGeneralTab();
      break;
  }
}

// ==================== TAB: Editor do Fluxo (Bot) ====================

let botFlowsCache = { list: [], selectedId: null, selectedData: null };

async function loadBotFlowsTab() {
  const container = document.getElementById('bot-flows-content');
  if (!container) return;

  try {
    const resp = await apiFetch('/bot-flows');
    const flows = resp?.flows || resp?.data?.flows || resp?.flows || [];
    botFlowsCache.list = flows;

    const initialId = botFlowsCache.selectedId || flows?.[0]?.id || null;
    botFlowsCache.selectedId = initialId;

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 class="mb-1"><i class="bi bi-diagram-3-fill text-primary"></i> Editor Visual de Fluxos</h4>
          <p class="text-muted mb-0">Edite os fluxos de forma visual e simples. Clique em um fluxo para começar.</p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" id="reloadBotFlowsBtn">
            <i class="bi bi-arrow-clockwise"></i> Recarregar
          </button>
        </div>
      </div>

      <div class="row g-3">
        <div class="col-lg-4">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <strong>Flows</strong>
              <span class="badge bg-secondary">${escapeHtml(String(flows.length))}</span>
            </div>
            <div class="card-body p-2">
              <input class="form-control form-control-sm mb-2" id="botFlowSearch" placeholder="Buscar por id/nome..." />
              <div class="list-group" id="botFlowsList" style="max-height: 60vh; overflow: auto;"></div>
            </div>
          </div>
        </div>

        <div class="col-lg-8">
          <div class="card h-100">
            <div class="card-header d-flex justify-content-between align-items-center">
              <div>
                <strong id="botFlowTitle">Selecione um flow</strong>
                <div class="text-muted small" id="botFlowSubtitle"></div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-outline-danger btn-sm" id="removeOverrideBtn" disabled>
                  <i class="bi bi-trash"></i> Remover override
                </button>
                <button class="btn btn-primary btn-sm" id="saveOverrideBtn" disabled>
                  <i class="bi bi-save"></i> Salvar alterações
                </button>
              </div>
            </div>
            <div class="card-body" style="overflow-y: auto; max-height: 70vh;">
              <!-- Guia de Uso -->
              <div class="alert alert-primary alert-dismissible fade show mb-3" role="alert">
                <h6 class="alert-heading mb-2"><i class="bi bi-lightbulb-fill"></i> Como editar os fluxos</h6>
                <div class="small">
                  <div class="mb-1"><i class="bi bi-1-circle-fill text-primary"></i> <strong>Clique em um fluxo</strong> na lista ao lado</div>
                  <div class="mb-1"><i class="bi bi-2-circle-fill text-primary"></i> <strong>Edite mensagens</strong> nos campos de texto</div>
                  <div class="mb-1"><i class="bi bi-3-circle-fill text-primary"></i> <strong>Escolha destinos</strong> nos menus dropdown</div>
                  <div><i class="bi bi-4-circle-fill text-primary"></i> <strong>Salve</strong> no botão acima para aplicar</div>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
              </div>

              <div id="botFlowCards" class="d-flex flex-column gap-3"></div>

              <details class="mt-4">
                <summary class="cursor-pointer text-muted fw-semibold">
                  <i class="bi bi-code-square"></i> Ver JSON completo (modo avançado)
                </summary>
                <pre class="mt-3 p-3 bg-dark text-white border rounded" style="font-size: 0.75rem; max-height: 45vh; overflow:auto; font-family: 'Courier New', monospace;" id="botFlowEffectiveJson"></pre>
              </details>

            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('reloadBotFlowsBtn')?.addEventListener('click', () => loadBotFlowsTab());

    // render lista e carregar flow inicial
    renderBotFlowsList(flows, botFlowsCache.selectedId);
    wireBotFlowSearch();
    if (botFlowsCache.selectedId) {
      await selectBotFlow(botFlowsCache.selectedId);
    }

  } catch (error) {
    console.error('Erro ao carregar bot flows:', error);
    showToast(error?.message || 'Falha ao carregar editor do fluxo do bot.', 'error');
  }
}

function renderBotFlowsList(flows, activeId) {
  const listEl = document.getElementById('botFlowsList');
  if (!listEl) return;

  // Ícones por tipo de fluxo
  const flowIcons = {
    'initial': 'bi-play-circle',
    'main_menu': 'bi-menu-button-wide',
    'client_flow': 'bi-person-check',
    'administrative_menu': 'bi-briefcase',
    'dp_menu': 'bi-people',
    'benefits_menu': 'bi-gift',
    'wait_for_agent': 'bi-headset',
    'default': 'bi-chat-dots'
  };

  listEl.innerHTML = (flows || []).map(f => {
    const icon = flowIcons[f.id] || flowIcons.default;
    const hasSteps = f.steps && f.steps.length > 0;
    const typeLabel = hasSteps ? `${f.steps.length} etapas` : 'menu';
    
    return `
      <button class="list-group-item list-group-item-action ${f.id === activeId ? 'active' : ''}"
              data-flow-id="${escapeHtml(f.id)}">
        <div class="d-flex justify-content-between align-items-start">
          <div class="text-start flex-grow-1">
            <div class="d-flex align-items-center gap-2 mb-1">
              <i class="bi ${icon} ${f.id === activeId ? 'text-white' : 'text-primary'}"></i>
              <div class="fw-semibold">${escapeHtml(f.id)}</div>
            </div>
            <div class="small ${f.id === activeId ? 'text-white-50' : 'text-muted'}">
              ${escapeHtml(f.name || '')}
            </div>
            <div class="small ${f.id === activeId ? 'text-white-50' : 'text-muted'} mt-1">
              <i class="bi bi-diagram-3"></i> ${typeLabel}
            </div>
          </div>
          <div class="d-flex flex-column align-items-end gap-1">
            ${f.hasOverride ? '<span class="badge bg-warning text-dark"><i class="bi bi-pencil"></i> Editado</span>' : ''}
          </div>
        </div>
      </button>
    `;
  }).join('');

  listEl.querySelectorAll('[data-flow-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-flow-id');
      await selectBotFlow(id);
      renderBotFlowsList(botFlowsCache.list, id);
    });
  });
}

function wireBotFlowSearch() {
  const input = document.getElementById('botFlowSearch');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = (input.value || '').trim().toLowerCase();
    const filtered = botFlowsCache.list.filter(f =>
      (f.id || '').toLowerCase().includes(q) ||
      (f.name || '').toLowerCase().includes(q)
    );
    renderBotFlowsList(filtered, botFlowsCache.selectedId);
  });
}

async function selectBotFlow(flowId) {
  botFlowsCache.selectedId = flowId;
  const title = document.getElementById('botFlowTitle');
  const subtitle = document.getElementById('botFlowSubtitle');
  const cards = document.getElementById('botFlowCards');
  const effectivePre = document.getElementById('botFlowEffectiveJson');
  const saveBtn = document.getElementById('saveOverrideBtn');
  const delBtn = document.getElementById('removeOverrideBtn');

  if (!title || !cards || !effectivePre || !saveBtn || !delBtn) return;

  saveBtn.disabled = true;
  delBtn.disabled = true;
  cards.innerHTML = '';
  effectivePre.textContent = '';
  title.textContent = `Flow: ${flowId}`;
  if (subtitle) subtitle.textContent = 'Carregando...';

  const data = await apiFetch(`/bot-flows/${encodeURIComponent(flowId)}`);
  // apiFetch retorna json.data quando existe; aqui o route retorna {success,data:{...}}
  const payload = data?.id ? data : data?.data;
  botFlowsCache.selectedData = payload;

  const flowMeta = botFlowsCache.list.find(f => f.id === flowId);
  if (subtitle) {
    subtitle.textContent = `${flowMeta?.type || ''}${flowMeta?.steps?.length ? ` • steps: ${flowMeta.steps.length}` : ''}`;
  }

  const effective = payload?.effective || {};
  const currentOverride = payload?.override || {};
  const draft = JSON.parse(JSON.stringify(currentOverride || {})); // clone JSON

  // SOMENTE NO SISTEMA: mostrar JSON traduzido para PT-BR (sem alterar schema real do bot)
  effectivePre.textContent = JSON.stringify(traduzirJsonParaPtBr(effective), null, 2);

  const allFlowIds = (botFlowsCache.list || []).map(f => f.id);
  cards.innerHTML = renderFlowAsCards(effective, flowId, allFlowIds);
  wireCardsEditors({ draft, allFlowIds });

  const hasOverride = !!payload?.override;
  saveBtn.disabled = false;
  delBtn.disabled = !hasOverride;

  saveBtn.onclick = async () => {
    try {
      await apiFetch(`/bot-flows/${encodeURIComponent(flowId)}`, {
        method: 'PUT',
        body: { override: draft }
      });
      showToast('Alterações salvas.', 'success');
      await loadBotFlowsTab();
    } catch (e) {
      showToast(e?.message || 'Falha ao salvar alterações.', 'error');
    }
  };

  delBtn.onclick = async () => {
    if (!confirm('Remover override deste flow?')) return;
    try {
      await apiFetch(`/bot-flows/${encodeURIComponent(flowId)}/override`, { method: 'DELETE' });
      showToast('Override removido.', 'success');
      await loadBotFlowsTab();
    } catch (e) {
      showToast(e?.message || 'Falha ao remover override.', 'error');
    }
  };
}

// ---------- helpers (cards/cascata) ----------

function isFnMarker(v) {
  return v && typeof v === 'object' && v.__type === 'function';
}

function msgToEditableText(v) {
  if (typeof v === 'string') return v;
  if (isFnMarker(v)) return '';
  return v == null ? '' : String(v);
}

function renderTargetSelectOptions({ allFlowIds, stepIds, current }) {
  const opts = [];
  opts.push(`<option value="">—</option>`);
  if (stepIds?.length) {
    opts.push(`<optgroup label="Steps (mesmo flow)">`);
    stepIds.forEach(id => {
      opts.push(`<option value="${escapeHtml(id)}" ${current === id ? 'selected' : ''}>${escapeHtml(id)}</option>`);
    });
    opts.push(`</optgroup>`);
  }
  opts.push(`<optgroup label="Flows">`);
  (allFlowIds || []).forEach(id => {
    opts.push(`<option value="${escapeHtml(id)}" ${current === id ? 'selected' : ''}>${escapeHtml(id)}</option>`);
  });
  opts.push(`</optgroup>`);
  return opts.join('');
}

function orderStepsCascade(steps) {
  const ids = Object.keys(steps || {});
  if (!ids.length) return [];

  const start = steps.start ? 'start' : ids[0];
  const out = [];
  const visited = new Set();

  function add(id) {
    if (!id || visited.has(id) || !steps[id]) return;
    visited.add(id);
    out.push(id);

    const step = steps[id] || {};
    [step.next, step.onSuccess, step.onFail].forEach(n => {
      if (typeof n === 'string' && steps[n]) add(n);
    });
    if (step.options) {
      for (const opt of Object.values(step.options)) {
        if (opt?.next && steps[opt.next]) add(opt.next);
      }
    }
  }

  add(start);
  ids.forEach(id => {
    if (!visited.has(id)) out.push(id);
  });
  return out;
}

function renderFlowAsCards(effective, flowId, allFlowIds) {
  const hasSteps = !!effective.steps;

  if (!hasSteps) {
    const msg = effective.message;
    const msgBaseHint = isFnMarker(msg)
      ? `<div class="alert alert-info small mb-2"><i class="bi bi-info-circle"></i> A mensagem base é dinâmica. Digite texto para substituí-la.</div>`
      : '';

    const options = effective.options || {};
    const optionRows = Object.entries(options).map(([key, opt]) => {
      const next = opt?.next || '';
      return `
        <div class="border rounded p-2 mb-2 bg-light">
          <div class="d-flex align-items-center justify-content-between gap-2">
            <div>
              <span class="badge bg-primary">${escapeHtml(key)}</span>
              ${opt?.label ? `<span class="ms-2 text-dark">${escapeHtml(opt.label)}</span>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="text-muted small"><i class="bi bi-arrow-right-circle"></i></span>
              <select class="form-select form-select-sm" style="min-width: 200px;" data-edit="flow-option-next" data-option-key="${escapeHtml(key)}">
                ${renderTargetSelectOptions({ allFlowIds, stepIds: [], current: next })}
              </select>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card shadow-sm border-primary">
        <div class="card-header bg-primary text-white">
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <i class="bi bi-menu-button-wide"></i> <strong>${escapeHtml(flowId)}</strong>
            </div>
            <span class="badge bg-white text-primary">Menu Simples</span>
          </div>
        </div>
        <div class="card-body">
          <!-- Mensagem -->
          <div class="mb-4">
            <label class="form-label fw-bold text-primary"><i class="bi bi-chat-text"></i> Mensagem do Menu</label>
            ${msgBaseHint}
            <textarea class="form-control" rows="5" placeholder="Digite a mensagem que o usuário verá..." data-edit="flow-message">${escapeHtml(msgToEditableText(msg))}</textarea>
            <small class="text-muted"><i class="bi bi-lightbulb"></i> Deixe vazio para manter a mensagem original</small>
          </div>

          <!-- Opções -->
          <div>
            <label class="form-label fw-bold text-success"><i class="bi bi-list-ol"></i> Opções do Menu</label>
            <div class="text-muted small mb-2">Quando o usuário responder com um número, ele será direcionado para:</div>
            <div class="d-flex flex-column">
              ${optionRows || '<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle"></i> Nenhuma opção definida</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const steps = effective.steps || {};
  const stepIds = Object.keys(steps);
  const ordered = orderStepsCascade(steps);

  return ordered.map((stepId, idx) => {
    const step = steps[stepId] || {};
    const msg = step.message ?? (Array.isArray(step.messages) ? step.messages.join('\n\n') : '');
    const msgHint = isFnMarker(step.message)
      ? `<div class="alert alert-info small mb-2"><i class="bi bi-info-circle"></i> A mensagem base é dinâmica. Digite texto para substituí-la.</div>`
      : '';

    const next = step.next || '';
    const onSuccess = step.onSuccess || '';
    const onFail = step.onFail || '';

    const stepOptions = step.options || {};
    const optRows = Object.entries(stepOptions).map(([key, opt]) => {
      const n = opt?.next || '';
      return `
        <div class="border rounded p-2 mb-2 bg-light">
          <div class="d-flex align-items-center justify-content-between gap-2">
            <div>
              <span class="badge bg-primary">${escapeHtml(key)}</span>
              ${opt?.label ? `<span class="ms-2 text-dark">${escapeHtml(opt.label)}</span>` : ''}
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="text-muted small"><i class="bi bi-arrow-right-circle"></i></span>
              <select class="form-select form-select-sm" style="min-width: 200px;" data-edit="step-option-next" data-step-id="${escapeHtml(stepId)}" data-option-key="${escapeHtml(key)}">
                ${renderTargetSelectOptions({ allFlowIds, stepIds, current: n })}
              </select>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Definir cor do card baseado no tipo de step
    let cardColor = 'border-primary';
    let badgeColor = 'bg-primary';
    let stepIcon = 'bi-chat-dots';
    
    if (step.action) {
      cardColor = 'border-warning';
      badgeColor = 'bg-warning';
      stepIcon = 'bi-lightning';
    } else if (step.collect) {
      cardColor = 'border-info';
      badgeColor = 'bg-info';
      stepIcon = 'bi-inbox';
    } else if (Object.keys(stepOptions).length) {
      cardColor = 'border-success';
      badgeColor = 'bg-success';
      stepIcon = 'bi-list-check';
    }

    const arrow = idx === 0 ? '' : `
      <div class="text-center my-3">
        <i class="bi bi-arrow-down-circle fs-4 text-primary"></i>
      </div>
    `;

    // Construir seção de navegação de forma mais visual
    const hasNavigation = next || onSuccess || onFail;
    const navigationHtml = hasNavigation ? `
      <div class="mt-3">
        <label class="form-label fw-bold text-secondary"><i class="bi bi-signpost-2"></i> Navegação</label>
        <div class="row g-2">
          ${next ? `
            <div class="col-md-12">
              <label class="small text-muted">Próximo passo</label>
              <select class="form-select form-select-sm" data-edit="step-next" data-step-id="${escapeHtml(stepId)}">
                ${renderTargetSelectOptions({ allFlowIds, stepIds, current: next })}
              </select>
            </div>
          ` : ''}
          ${onSuccess || onFail ? `
            <div class="col-md-6">
              <label class="small text-success">Se sucesso</label>
              <select class="form-select form-select-sm" data-edit="step-onSuccess" data-step-id="${escapeHtml(stepId)}">
                ${renderTargetSelectOptions({ allFlowIds, stepIds, current: onSuccess })}
              </select>
            </div>
            <div class="col-md-6">
              <label class="small text-danger">Se falhar</label>
              <select class="form-select form-select-sm" data-edit="step-onFail" data-step-id="${escapeHtml(stepId)}">
                ${renderTargetSelectOptions({ allFlowIds, stepIds, current: onFail })}
              </select>
            </div>
          ` : ''}
        </div>
      </div>
    ` : '';

    return `
      ${arrow}
      <div class="card shadow-sm ${cardColor}">
        <div class="card-header ${badgeColor} bg-opacity-10">
          <div class="d-flex align-items-center justify-content-between">
            <div>
              <i class="bi ${stepIcon}"></i>
              <strong class="ms-1">${escapeHtml(stepId)}</strong>
              ${step.action ? `<span class="badge bg-warning text-dark ms-2"><i class="bi bi-lightning-fill"></i> Ação</span>` : ''}
              ${step.collect ? `<span class="badge bg-info ms-2"><i class="bi bi-inbox-fill"></i> Coleta</span>` : ''}
            </div>
            <span class="badge bg-secondary">${idx + 1}/${ordered.length}</span>
          </div>
        </div>
        <div class="card-body">
          <!-- Mensagem -->
          ${msg || msgHint ? `
            <div class="mb-3">
              <label class="form-label fw-bold text-primary"><i class="bi bi-chat-text"></i> Mensagem</label>
              ${msgHint}
              <textarea class="form-control" rows="4" placeholder="Digite a mensagem que o bot enviará..." data-edit="step-message" data-step-id="${escapeHtml(stepId)}">${escapeHtml(msgToEditableText(msg))}</textarea>
              <small class="text-muted"><i class="bi bi-lightbulb"></i> Deixe vazio para manter a mensagem original</small>
            </div>
          ` : ''}

          <!-- Opções do Menu (se houver) -->
          ${Object.keys(stepOptions).length ? `
            <div class="mb-3">
              <label class="form-label fw-bold text-success"><i class="bi bi-list-ol"></i> Opções do Menu</label>
              <div class="text-muted small mb-2">O usuário pode escolher:</div>
              <div class="d-flex flex-column">${optRows}</div>
            </div>
          ` : ''}

          <!-- Navegação -->
          ${navigationHtml}
        </div>
      </div>
    `;
  }).join('');
}

function wireCardsEditors({ draft, allFlowIds }) {
  const root = document.getElementById('botFlowCards');
  if (!root) return;

  // fluxo simples: mensagem
  root.querySelectorAll('[data-edit="flow-message"]').forEach((ta) => {
    ta.addEventListener('input', () => {
      const val = ta.value;
      if (!val.trim()) delete draft.message;
      else draft.message = val;
    });
  });

  // fluxo simples: opções
  root.querySelectorAll('[data-edit="flow-option-next"]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const key = sel.getAttribute('data-option-key');
      const val = sel.value || '';
      if (!draft.options) draft.options = {};
      if (!draft.options[key]) draft.options[key] = {};
      if (!val) delete draft.options[key].next;
      else draft.options[key].next = val;
    });
  });

  // steps: mensagem
  root.querySelectorAll('[data-edit="step-message"]').forEach((ta) => {
    ta.addEventListener('input', () => {
      const stepId = ta.getAttribute('data-step-id');
      const val = ta.value;
      if (!draft.steps) draft.steps = {};
      if (!draft.steps[stepId]) draft.steps[stepId] = {};
      if (!val.trim()) delete draft.steps[stepId].message;
      else draft.steps[stepId].message = val;
    });
  });

  function wireStepPointer(attr, field) {
    root.querySelectorAll(`[data-edit="${attr}"]`).forEach((sel) => {
      sel.addEventListener('change', () => {
        const stepId = sel.getAttribute('data-step-id');
        const val = sel.value || '';
        if (!draft.steps) draft.steps = {};
        if (!draft.steps[stepId]) draft.steps[stepId] = {};
        if (!val) delete draft.steps[stepId][field];
        else draft.steps[stepId][field] = val;
      });
    });
  }

  wireStepPointer('step-next', 'next');
  wireStepPointer('step-onSuccess', 'onSuccess');
  wireStepPointer('step-onFail', 'onFail');

  // steps: opções
  root.querySelectorAll('[data-edit="step-option-next"]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const stepId = sel.getAttribute('data-step-id');
      const key = sel.getAttribute('data-option-key');
      const val = sel.value || '';
      if (!draft.steps) draft.steps = {};
      if (!draft.steps[stepId]) draft.steps[stepId] = {};
      if (!draft.steps[stepId].options) draft.steps[stepId].options = {};
      if (!draft.steps[stepId].options[key]) draft.steps[stepId].options[key] = {};
      if (!val) delete draft.steps[stepId].options[key].next;
      else draft.steps[stepId].options[key].next = val;
    });
  });
}

// ---------- helpers (json em português - SOMENTE VISUALIZAÇÃO NO SISTEMA) ----------

function traduzirChaveJson(chave) {
  const map = {
    id: 'id',
    name: 'nome',
    type: 'tipo',
    message: 'mensagem',
    messages: 'mensagens',
    steps: 'etapas',
    options: 'opcoes',
    next: 'proximo',
    onSuccess: 'aoSucesso',
    onFail: 'aoFalhar',
    action: 'acao',
    collect: 'coletar',
    label: 'rotulo',
    department: 'departamento',
    transfer: 'transferir',
    backTo: 'voltarPara',
    keywords: 'palavrasChave',
    value: 'valor'
  };
  return map[chave] || chave;
}

function traduzirJsonParaPtBr(valor) {
  if (valor == null) return valor;
  if (Array.isArray(valor)) return valor.map(traduzirJsonParaPtBr);
  if (typeof valor === 'object') {
    // marcador de função do backend: { __type: 'function', source: '...' }
    if (valor.__type === 'function') {
      return { tipo: 'funcao', fonte: valor.source };
    }
    const out = {};
    for (const [k, v] of Object.entries(valor)) {
      out[traduzirChaveJson(k)] = traduzirJsonParaPtBr(v);
    }
    return out;
  }
  return valor;
}

// ==================== TAB: IA Inteligente ====================

async function loadAITab() {
  const container = document.getElementById('ai-content');
  if (!container) return;

  try {
    // Carregar configurações e analytics
    const [config, analytics, intents] = await Promise.all([
      apiFetch('/ai/config'),
      apiFetch('/ai/analytics?days=7'),
      apiFetch('/ai/intents')
    ]);

    // apiFetch já retorna o .data diretamente
    const cfg = config || {};
    const stats = analytics || {};
    const intentList = intents || [];

    container.innerHTML = `
      <div class="mb-4">
        <h4 class="mb-2"><i class="bi bi-robot text-primary"></i> Assistente IA Inteligente</h4>
        <p class="text-muted">Configure o sistema híbrido que entende linguagem natural e direciona automaticamente ao departamento certo.</p>
      </div>

      <div class="row g-3 mb-4">
        <!-- Card Status -->
        <div class="col-md-4">
          <div class="card ${cfg.enabled ? 'border-success' : 'border-secondary'}">
            <div class="card-body text-center">
              <i class="bi ${cfg.enabled ? 'bi-check-circle-fill text-success' : 'bi-x-circle text-secondary'} fs-1"></i>
              <h5 class="mt-2">${cfg.enabled ? 'IA Ativada' : 'IA Desativada'}</h5>
              <p class="text-muted small">${cfg.enabled ? 'Sistema híbrido em funcionamento' : 'Usando apenas menus tradicionais'}</p>
            </div>
          </div>
        </div>

        <!-- Card Provider -->
        <div class="col-md-4">
          <div class="card border-primary">
            <div class="card-body text-center">
              <i class="bi bi-cloud fs-1 text-primary"></i>
              <h5 class="mt-2">${cfg.provider || 'N/A'}</h5>
              <p class="text-muted small">Provider de IA</p>
              <small class="badge bg-secondary">${cfg.model || 'N/A'}</small>
            </div>
          </div>
        </div>

        <!-- Card Classificações -->
        <div class="col-md-4">
          <div class="card border-info">
            <div class="card-body text-center">
              <i class="bi bi-graph-up fs-1 text-info"></i>
              <h5 class="mt-2">${stats.summary?.totalClassifications || 0}</h5>
              <p class="text-muted small">Classificações (7 dias)</p>
              <small class="text-muted">Taxa de uso: ${stats.summary?.usageRate || 0}%</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Configurações -->
      <div class="card mb-4">
        <div class="card-header bg-primary text-white">
          <i class="bi bi-sliders"></i> <strong>Configurações da IA</strong>
        </div>
        <div class="card-body">
          <form id="aiConfigForm">
            <div class="row g-3">
              <!-- Ativar/Desativar -->
              <div class="col-md-12">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" id="aiEnabled" ${cfg.enabled ? 'checked' : ''}>
                  <label class="form-check-label fw-bold" for="aiEnabled">
                    Ativar Sistema Híbrido (IA + Menus)
                  </label>
                  <div class="form-text">Quando ativado, a IA tenta entender a mensagem antes de mostrar menus numerados</div>
                </div>
              </div>

              <!-- Provider -->
              <div class="col-md-6">
                <label class="form-label">Provider de IA</label>
                <select class="form-select" id="aiProvider">
                  <option value="gemini" ${cfg.provider === 'gemini' ? 'selected' : ''}>🆓 Google Gemini (GRÁTIS)</option>
                  <option value="groq" ${cfg.provider === 'groq' ? 'selected' : ''}>⚡ Groq (GRÁTIS + RÁPIDO)</option>
                  <option value="openai" ${cfg.provider === 'openai' ? 'selected' : ''}>💰 OpenAI (GPT) - Pago</option>
                  <option value="claude" ${cfg.provider === 'claude' ? 'selected' : ''}>💰 Anthropic (Claude) - Pago</option>
                </select>
                <div class="form-text">
                  <strong>Gemini e Groq são gratuitos!</strong> Recomendado enquanto não tiver créditos.
                </div>
              </div>

              <!-- Modelo -->
              <div class="col-md-6">
                <label class="form-label">Modelo</label>
                <select class="form-select" id="aiModel">
                  <option value="gemini-2.5-flash" ${cfg.model === 'gemini-2.5-flash' || cfg.model === 'gemini-pro' ? 'selected' : ''}>Gemini 2.5 Flash (Grátis + Rápido)</option>
                  <option value="gemini-2.5-pro" ${cfg.model === 'gemini-2.5-pro' ? 'selected' : ''}>Gemini 2.5 Pro (Grátis + Preciso)</option>
                  <option value="llama-3.1-8b-instant" ${cfg.model === 'llama-3.1-8b-instant' || cfg.model === 'mixtral-8x7b-32768' ? 'selected' : ''}>Llama 3.1 8B (Groq - Grátis)</option>
                  <option value="meta-llama/llama-4-maverick-17b-128e-instruct" ${cfg.model === 'meta-llama/llama-4-maverick-17b-128e-instruct' ? 'selected' : ''}>Llama 4 Maverick (Groq - Mais potente)</option>
                  <option value="gpt-3.5-turbo" ${cfg.model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo (Rápido)</option>
                  <option value="gpt-4" ${cfg.model === 'gpt-4' ? 'selected' : ''}>GPT-4 (Preciso)</option>
                  <option value="gpt-4-turbo" ${cfg.model === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
                </select>
              </div>

              <!-- API Key -->
              <div class="col-md-12">
                <label class="form-label">API Key</label>
                <div class="input-group">
                  <input type="password" class="form-control" id="aiApiKey" placeholder="Digite sua API Key" value="">
                  <button class="btn btn-outline-secondary" type="button" onclick="document.getElementById('aiApiKey').type = document.getElementById('aiApiKey').type === 'password' ? 'text' : 'password'">
                    <i class="bi bi-eye"></i>
                  </button>
                </div>
                <div class="form-text mt-2">
                  ${cfg.apiKey ? `<span class="text-success"><i class="bi bi-check-circle"></i> API Key configurada (${cfg.apiKey})</span>` : '<span class="text-warning"><i class="bi bi-exclamation-triangle"></i> Nenhuma API Key configurada</span>'}
                  <br>
                  <strong>🆓 Obter API Key GRATUITA:</strong><br>
                  • <strong>Gemini:</strong> <a href="https://makersuite.google.com/app/apikey" target="_blank">makersuite.google.com/app/apikey</a><br>
                  • <strong>Groq:</strong> <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a><br>
                  • <strong>OpenAI:</strong> <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a> (pago)
                </div>
              </div>

              <!-- Confiança Mínima -->
              <div class="col-md-6">
                <label class="form-label">Confiança Mínima (${(cfg.confidenceThreshold || 0.7) * 100}%)</label>
                <input type="range" class="form-range" id="aiConfidenceThreshold" min="0" max="1" step="0.05" value="${cfg.confidenceThreshold || 0.7}" oninput="document.querySelector('[for=aiConfidenceThreshold]').textContent = 'Confiança Mínima (' + (this.value * 100).toFixed(0) + '%)'">
                <div class="form-text">Se a IA tiver confiança abaixo disso, mostra menu tradicional</div>
              </div>

              <!-- Temperature -->
              <div class="col-md-6">
                <label class="form-label">Temperature (${cfg.temperature || 0.3})</label>
                <input type="range" class="form-range" id="aiTemperature" min="0" max="1" step="0.1" value="${cfg.temperature || 0.3}" oninput="document.querySelector('[for=aiTemperature]').textContent = 'Temperature (' + this.value + ')'">
                <div class="form-text">Menor = mais preciso, Maior = mais criativo</div>
              </div>

              <!-- Botões -->
              <div class="col-12">
                <button type="submit" class="btn btn-primary">
                  <i class="bi bi-save"></i> Salvar Configurações
                </button>
                <button type="button" class="btn btn-outline-secondary" id="testAIBtn">
                  <i class="bi bi-lightning"></i> Testar IA
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Treinamento da IA (Exemplos) -->
      <div class="card mb-4">
        <div class="card-header bg-success text-white">
          <i class="bi bi-lightbulb"></i> <strong>Treinar IA com Exemplos</strong>
        </div>
        <div class="card-body">
          <p class="text-muted small mb-3">Adicione exemplos de mensagens e suas classificações corretas para ensinar a IA a julgar melhor os assuntos.</p>
          
          <form id="addTrainingExampleForm">
            <div class="row g-2">
              <div class="col-md-5">
                <input type="text" class="form-control form-control-sm" id="trainingMessage" placeholder="Ex: quero tirar férias" required>
              </div>
              <div class="col-md-3">
                <select class="form-select form-select-sm" id="trainingIntent" required>
                  <option value="">Selecione o setor</option>
                  <option value="dp">DP (Departamento Pessoal)</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="rh">RH (Recursos Humanos)</option>
                  <option value="compras">Compras</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="logistica">Logística</option>
                  <option value="seguranca">Segurança do Trabalho</option>
                  <option value="faturamento">Faturamento</option>
                  <option value="comercial">Comercial</option>
                  <option value="operacional">Operacional</option>
                  <option value="novo_cliente">Novo Cliente</option>
                  <option value="trabalhe_conosco">Trabalhe Conosco</option>
                  <option value="atendimento_humano">Atendimento Humano</option>
                </select>
              </div>
              <div class="col-md-3">
                <input type="text" class="form-control form-control-sm" id="trainingReasoning" placeholder="Ex: Solicitação de férias" required>
              </div>
              <div class="col-md-1">
                <button type="submit" class="btn btn-sm btn-success w-100"><i class="bi bi-plus"></i></button>
              </div>
            </div>
          </form>

          <div class="mt-3">
            <h6 class="small">Exemplos Atuais: <span class="badge bg-secondary">${intentList.length || 0}</span></h6>
            <button class="btn btn-sm btn-outline-primary" id="viewTrainingExamplesBtn">
              <i class="bi bi-list"></i> Ver Exemplos
            </button>
          </div>
        </div>
      </div>

      <!-- Analytics -->
      <div class="card mb-4">
        <div class="card-header bg-info text-white">
          <i class="bi bi-bar-chart"></i> <strong>Analytics (Últimos 7 dias)</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6">
              <h6>Por Intenção</h6>
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Intenção</th>
                      <th>Vezes</th>
                      <th>Confiança</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(stats.byIntent || []).map(s => `
                      <tr>
                        <td>${escapeHtml(s.intent)}</td>
                        <td><span class="badge bg-primary">${s.count}</span></td>
                        <td>${(parseFloat(s.avgConfidence) * 100).toFixed(1)}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="col-md-6">
              <h6>Por Método</h6>
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Método</th>
                      <th>Vezes</th>
                      <th>Tempo Médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(stats.byMethod || []).map(s => `
                      <tr>
                        <td><span class="badge ${s.method === 'keywords' ? 'bg-success' : 'bg-warning'}">${escapeHtml(s.method)}</span></td>
                        <td>${s.count}</td>
                        <td>${s.avgProcessingTime ? Math.round(s.avgProcessingTime) + 'ms' : 'N/A'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Intenções Disponíveis -->
      <div class="card">
        <div class="card-header">
          <i class="bi bi-list-check"></i> <strong>Intenções Disponíveis (${intentList.length})</strong>
        </div>
        <div class="card-body">
          <div class="row g-2">
            ${Array.isArray(intentList) && intentList.length > 0 ? intentList.map(intent => `
              <div class="col-md-6">
                <div class="border rounded p-2">
                  <div class="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>${escapeHtml(intent.id)}</strong>
                      <div class="small text-muted">→ ${escapeHtml(intent.flow)}</div>
                    </div>
                    <span class="badge bg-secondary">${intent.keywordCount || 0} palavras</span>
                  </div>
                  <div class="small text-muted mt-1">
                    ${(intent.keywords || []).slice(0, 5).join(', ')}${(intent.keywords || []).length > 5 ? '...' : ''}
                  </div>
                </div>
              </div>
            `).join('') : '<div class="col-12 text-center text-muted">Nenhuma intenção configurada</div>'}
          </div>
        </div>
      </div>
    `;

    // Event listeners
    document.getElementById('aiConfigForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveAIConfig();
    });

    document.getElementById('testAIBtn').addEventListener('click', async () => {
      await testAI();
    });

    document.getElementById('addTrainingExampleForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await addTrainingExample();
    });

    document.getElementById('viewTrainingExamplesBtn').addEventListener('click', async () => {
      await viewTrainingExamples();
    });

  } catch (error) {
    console.error('Erro ao carregar IA tab:', error);
    showToast(error?.message || 'Erro ao carregar configurações da IA', 'error');
  }
}

async function addTrainingExample() {
  try {
    const message = document.getElementById('trainingMessage').value.trim();
    const intent = document.getElementById('trainingIntent').value;
    const reasoning = document.getElementById('trainingReasoning').value.trim();

    if (!message || !intent || !reasoning) {
      showToast('Preencha todos os campos!', 'warning');
      return;
    }

    // Carregar exemplos atuais
    const response = await apiFetch('/ai/training-examples');
    const examples = response.examples || [];

    // Adicionar novo exemplo
    examples.push({ message, intent, reasoning });

    // Salvar
    await apiFetch('/ai/training-examples', {
      method: 'POST',
      body: { examples }
    });

    showToast('✅ Exemplo adicionado! A IA aprenderá com ele.', 'success');
    
    // Limpar formulário
    document.getElementById('trainingMessage').value = '';
    document.getElementById('trainingIntent').value = '';
    document.getElementById('trainingReasoning').value = '';

    // Recarregar aba
    await loadAITab();
  } catch (error) {
    console.error('Erro ao adicionar exemplo:', error);
    showToast(error?.message || 'Erro ao adicionar exemplo', 'error');
  }
}

async function viewTrainingExamples() {
  try {
    const response = await apiFetch('/ai/training-examples');
    const examples = response.examples || [];

    if (examples.length === 0) {
      showToast('Nenhum exemplo cadastrado ainda.', 'info');
      return;
    }

    const html = examples.map((ex, i) => `
      <div class="border-bottom pb-2 mb-2">
        <strong>#${i + 1}:</strong> "${ex.message}"<br>
        <small class="text-muted">→ ${ex.intent} (${ex.reasoning})</small>
        <button class="btn btn-sm btn-outline-danger float-end" onclick="removeTrainingExample(${i})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `).join('');

    const modal = `
      <div class="modal fade" id="trainingExamplesModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Exemplos de Treinamento (${examples.length})</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" style="max-height: 500px; overflow-y: auto;">
              ${html}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remover modal antigo se existir
    const oldModal = document.getElementById('trainingExamplesModal');
    if (oldModal) oldModal.remove();

    // Adicionar novo modal
    document.body.insertAdjacentHTML('beforeend', modal);
    
    // Mostrar modal
    const modalEl = new bootstrap.Modal(document.getElementById('trainingExamplesModal'));
    modalEl.show();

  } catch (error) {
    console.error('Erro ao carregar exemplos:', error);
    showToast(error?.message || 'Erro ao carregar exemplos', 'error');
  }
}

window.removeTrainingExample = async function(index) {
  if (!confirm('Tem certeza que deseja remover este exemplo?')) return;

  try {
    const response = await apiFetch('/ai/training-examples');
    const examples = response.examples || [];
    examples.splice(index, 1);

    await apiFetch('/ai/training-examples', {
      method: 'POST',
      body: { examples }
    });

    showToast('Exemplo removido!', 'success');
    
    // Fechar e reabrir modal
    bootstrap.Modal.getInstance(document.getElementById('trainingExamplesModal')).hide();
    await viewTrainingExamples();
    await loadAITab();
  } catch (error) {
    console.error('Erro ao remover exemplo:', error);
    showToast(error?.message || 'Erro ao remover exemplo', 'error');
  }
}

async function saveAIConfig() {
  try {
    console.log('🔧 [FRONTEND] saveAIConfig() iniciado');
    
    const config = {
      enabled: document.getElementById('aiEnabled').checked,
      provider: document.getElementById('aiProvider').value,
      model: document.getElementById('aiModel').value,
      apiKey: document.getElementById('aiApiKey').value || undefined,
      confidenceThreshold: parseFloat(document.getElementById('aiConfidenceThreshold').value),
      temperature: parseFloat(document.getElementById('aiTemperature').value)
    };

    console.log('🔧 [FRONTEND] Config a enviar:', JSON.stringify({ ...config, apiKey: config.apiKey ? '***' : undefined }, null, 2));
    console.log('🔧 [FRONTEND] Enviando PUT para /api/ai/config...');

    const response = await apiFetch('/ai/config', {
      method: 'PUT',
      body: config
    });

    console.log('✅ [FRONTEND] Resposta recebida:', JSON.stringify(response, null, 2));

    showToast('Configurações salvas com sucesso!', 'success');
    await loadAITab();
  } catch (error) {
    console.error('❌ [FRONTEND] Erro ao salvar config:', error);
    console.error('❌ [FRONTEND] Stack:', error.stack);
    showToast(error?.message || 'Erro ao salvar configurações', 'error');
  }
}

async function testAI() {
  const message = prompt('Digite uma mensagem para testar a IA:\n\nExemplo: "preciso tirar férias"');
  if (!message) return;

  try {
    const result = await apiFetch('/ai/test', {
      method: 'POST',
      body: { message, userContext: {} }
    });

    const data = result?.data || {};
    
    alert(`🧠 Resultado do Teste:\n\n` +
          `Intent: ${data.intent || 'N/A'}\n` +
          `Fluxo: ${data.flow || 'N/A'}\n` +
          `Confiança: ${((data.confidence || 0) * 100).toFixed(1)}%\n` +
          `Método: ${data.method || 'N/A'}\n` +
          `Tempo: ${data.processingTimeMs || 0}ms\n\n` +
          `${data.reasoning || ''}`);
  } catch (error) {
    showToast(error?.message || 'Erro ao testar IA', 'error');
  }
}

/**
 * TAB: Fluxos
 */
async function loadFlowsTab() {
  const container = document.getElementById('flows-content');
  if (!container) return;

  try {
    const [flowsResp, sessionsResp, botFlowsResp] = await Promise.all([
      apiFetch('/flows'),
      apiFetch('/sessions'),
      apiFetch('/conversation-flows')
    ]);

    // Normalizar dados para arrays
    const flows = Array.isArray(flowsResp) ? flowsResp : (flowsResp?.data || flowsResp?.flows || []);
    const sessions = Array.isArray(sessionsResp) ? sessionsResp : (sessionsResp?.data || sessionsResp?.sessions || []);
    const botFlows = Array.isArray(botFlowsResp) ? botFlowsResp : (botFlowsResp?.data || botFlowsResp?.flows || []);

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 class="mb-1">Fluxos de Conversa</h4>
          <p class="text-muted mb-0">Crie fluxos personalizados para automatizar conversas</p>
        </div>
        <button class="btn btn-primary" id="newFlowBtn">
          <i class="bi bi-plus-circle"></i> Novo Fluxo
        </button>
      </div>

      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div>
            <strong>Fluxo atual das conversas (sessões ativas)</strong>
            <div class="text-muted small">Use para diagnosticar e configurar manualmente o fluxo atual por telefone.</div>
          </div>
          <button class="btn btn-sm btn-outline-secondary" id="refreshSessionsFlowBtn">
            <i class="bi bi-arrow-clockwise"></i> Atualizar
          </button>
        </div>
        <div class="card-body">
          ${renderActiveSessionsFlowTable(sessions, botFlows)}
        </div>
      </div>

      <div class="row g-3" id="flowsList">
        ${flows.length === 0 ? `
          <div class="col-12">
            <div class="empty-state">
              <i class="bi bi-diagram-3 empty-icon"></i>
              <h5 class="mt-3">Nenhum fluxo criado</h5>
              <p class="text-muted">Comece criando seu primeiro fluxo de conversa!</p>
              <button class="btn btn-primary mt-2" onclick="document.getElementById('newFlowBtn').click()">
                <i class="bi bi-plus-circle"></i> Criar Primeiro Fluxo
              </button>
            </div>
          </div>
        ` : flows.map(flow => renderFlowCard(flow)).join('')}
      </div>
    `;

    // Event listener para novo fluxo
    document.getElementById('newFlowBtn')?.addEventListener('click', () => openFlowModal());
    document.getElementById('refreshSessionsFlowBtn')?.addEventListener('click', () => loadFlowsTab());

  } catch (error) {
    console.error('Erro ao carregar fluxos:', error);
    showToast('Falha ao carregar fluxos.', 'error');
  }
}

function renderActiveSessionsFlowTable(sessions, botFlows) {
  const list = Array.isArray(sessions) ? sessions : [];
  const flows = Array.isArray(botFlows) ? botFlows : [];

  if (!list.length) {
    return `<div class="text-center text-muted">Nenhuma sessão ativa no momento.</div>`;
  }

  const optionsHtml = flows.map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.id)} — ${escapeHtml(f.name)}</option>`).join('');

  return `
    <div class="table-responsive">
      <table class="table table-sm table-hover align-middle">
        <thead>
          <tr>
            <th>Telefone</th>
            <th>Nome</th>
            <th>Flow atual</th>
            <th>Step atual</th>
            <th>Alterar para</th>
            <th class="text-end">Ação</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => {
            const userId = String(s.userId || '');
            const currentFlow = s.currentFlow || s.currentDepartment || '—';
            const currentStep = s.currentStep || '—';
            const last = s.lastInteraction || s.updatedAt || s.createdAt || null;
            const lastLabel = last ? new Date(last).toLocaleString('pt-BR') : '—';

            const safeUserId = escapeHtml(userId);

            return `
              <tr>
                <td class="text-muted">${safeUserId}</td>
                <td class="fw-semibold">${escapeHtml(s.userName || '—')}</td>
                <td><code>${escapeHtml(currentFlow)}</code></td>
                <td><code>${escapeHtml(currentStep)}</code></td>
                <td>
                  <div class="d-flex gap-2">
                    <select class="form-select form-select-sm" id="setFlow_${safeUserId}">
                      <option value="">— selecione —</option>
                      ${optionsHtml}
                    </select>
                    <input class="form-control form-control-sm" id="setStep_${safeUserId}" placeholder="start" />
                    <div class="form-check ms-2">
                      <input class="form-check-input" type="checkbox" id="resetCtx_${safeUserId}" checked>
                      <label class="form-check-label small" for="resetCtx_${safeUserId}">reset</label>
                    </div>
                  </div>
                  <div class="text-muted small mt-1">Última interação: ${escapeHtml(lastLabel)}</div>
                </td>
                <td class="text-end">
                  <button class="btn btn-sm btn-primary" onclick="window.applySessionFlow('${safeUserId}')">
                    Aplicar
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

window.applySessionFlow = async function(userId) {
  try {
    const flowEl = document.getElementById(`setFlow_${userId}`);
    const stepEl = document.getElementById(`setStep_${userId}`);
    const resetEl = document.getElementById(`resetCtx_${userId}`);

    const currentFlow = flowEl?.value?.trim();
    const currentStep = stepEl?.value?.trim();
    const resetContext = resetEl?.checked !== false;

    if (!currentFlow) {
      showToast('Selecione um flow para aplicar.', 'warning');
      return;
    }

    await apiFetch(`/sessions/${encodeURIComponent(userId)}/flow`, {
      method: 'PATCH',
      body: {
        currentFlow,
        currentStep: currentStep || undefined,
        resetContext
      }
    });

    showToast('Fluxo da conversa atualizado.', 'success');
    await loadFlowsTab();
  } catch (error) {
    console.error('Erro ao aplicar fluxo:', error);
    showToast(error?.message || 'Falha ao atualizar fluxo da conversa.', 'error');
  }
};

function renderFlowCard(flow) {
  const statusColors = {
    active: 'success',
    draft: 'warning',
    archived: 'secondary'
  };
  
  const statusLabels = {
    active: 'Ativo',
    draft: 'Rascunho',
    archived: 'Arquivado'
  };

  return `
    <div class="col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h5 class="card-title mb-0">${escapeHtml(flow.name)}</h5>
            <span class="badge bg-${statusColors[flow.status]}">${statusLabels[flow.status]}</span>
          </div>
          <p class="card-text text-muted small mb-3">${escapeHtml(flow.description || 'Sem descrição')}</p>
          
          <div class="small text-muted mb-3">
            <div><i class="bi bi-lightning"></i> Gatilho: <strong>${escapeHtml(flow.trigger)}</strong></div>
            <div><i class="bi bi-list-ol"></i> ${flow.steps?.length || 0} steps</div>
            ${flow.department ? `<div><i class="bi bi-building"></i> ${escapeHtml(flow.department)}</div>` : ''}
          </div>

          <div class="btn-group w-100" role="group">
            <button class="btn btn-sm btn-outline-primary" data-action="edit-flow" data-id="${flow.id}">
              <i class="bi bi-pencil"></i> Editar
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="duplicate-flow" data-id="${flow.id}">
              <i class="bi bi-files"></i> Duplicar
            </button>
            ${flow.status === 'draft' ? `
              <button class="btn btn-sm btn-success" data-action="activate-flow" data-id="${flow.id}">
                <i class="bi bi-play"></i>
              </button>
            ` : ''}
            ${flow.status === 'active' ? `
              <button class="btn btn-sm btn-warning" data-action="archive-flow" data-id="${flow.id}">
                <i class="bi bi-archive"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * TAB: Templates
 */
async function loadTemplatesTab() {
  const container = document.getElementById('templates-content');
  if (!container) return;

  try {
    const templatesResp = await apiFetch('/templates');
    const templates = Array.isArray(templatesResp) ? templatesResp : (templatesResp?.data || templatesResp?.templates || []);

    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 class="mb-1">Templates de Mensagens</h4>
          <p class="text-muted mb-0">Crie mensagens reutilizáveis com variáveis</p>
        </div>
        <button class="btn btn-primary" id="newTemplateBtn">
          <i class="bi bi-plus-circle"></i> Novo Template
        </button>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Prévia</th>
                  <th>Variáveis</th>
                  <th>Departamento</th>
                  <th class="text-end">Ações</th>
                </tr>
              </thead>
              <tbody id="templatesTableBody">
                ${templates.length === 0 ? `
                  <tr><td colspan="6" class="text-center text-muted">Nenhum template criado</td></tr>
                ` : templates.map(t => `
                  <tr>
                    <td class="fw-semibold">${escapeHtml(t.name)}</td>
                    <td><span class="badge bg-info">${escapeHtml(t.category)}</span></td>
                    <td class="text-truncate" style="max-width: 300px;">${escapeHtml(t.content)}</td>
                    <td>${t.variables?.length || 0}</td>
                    <td>${escapeHtml(t.department || '—')}</td>
                    <td class="text-end">
                      <button class="btn btn-sm btn-outline-primary" data-action="edit-template" data-id="${t.id}">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <button class="btn btn-sm btn-outline-secondary" data-action="duplicate-template" data-id="${t.id}">
                        <i class="bi bi-files"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('newTemplateBtn')?.addEventListener('click', () => openTemplateModal());

  } catch (error) {
    console.error('Erro ao carregar templates:', error);
    showToast({ title: 'Erro', message: 'Falha ao carregar templates.', variant: 'danger' });
  }
}

/**
 * TAB: Configurações Gerais
 */
async function loadGeneralTab() {
  const container = document.getElementById('general-content');
  if (!container) return;

  container.innerHTML = `
    <div class="row g-4">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0"><i class="bi bi-robot"></i> Bot</h5>
          </div>
          <div class="card-body">
            <form>
              <div class="mb-3">
                <label class="form-label">Nome do Bot</label>
                <input type="text" class="form-control" value="Assistente Virtual" />
              </div>
              <div class="mb-3">
                <label class="form-label">Tempo de Inatividade (minutos)</label>
                <input type="number" class="form-control" value="30" />
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="autoCloseTickets" checked />
                <label class="form-check-label" for="autoCloseTickets">
                  Fechar tickets inativos automaticamente
                </label>
              </div>
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-save"></i> Salvar
              </button>
            </form>
          </div>
        </div>
      </div>

      <div class="col-md-6">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0"><i class="bi bi-bell"></i> Notificações</h5>
          </div>
          <div class="card-body">
            <form>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="notifyNewTicket" checked />
                <label class="form-check-label" for="notifyNewTicket">
                  Novo ticket criado
                </label>
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="notifyWaitingHuman" checked />
                <label class="form-check-label" for="notifyWaitingHuman">
                  Cliente solicitou atendente
                </label>
              </div>
              <div class="mb-3 form-check">
                <input type="checkbox" class="form-check-input" id="notifyNewMessage" />
                <label class="form-check-label" for="notifyNewMessage">
                  Nova mensagem em ticket
                </label>
              </div>
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-save"></i> Salvar
              </button>
            </form>
          </div>
        </div>
      </div>

      <div class="col-12">
        <div class="card">
          <div class="card-header">
            <h5 class="mb-0"><i class="bi bi-shield-check"></i> Avançado</h5>
          </div>
          <div class="card-body">
            <div class="alert alert-warning">
              <i class="bi bi-exclamation-triangle"></i>
              <strong>Atenção:</strong> Configurações avançadas podem afetar o funcionamento do sistema.
            </div>
            <button class="btn btn-danger" id="clearCacheBtn">
              <i class="bi bi-trash"></i> Limpar Cache
            </button>
            <button class="btn btn-warning ms-2" id="resetSessionsBtn">
              <i class="bi bi-arrow-clockwise"></i> Resetar Todas as Sessões
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function openFlowModal(flowId = null) {
  showToast({ title: 'Em desenvolvimento', message: 'Editor de fluxos será implementado na próxima fase!', variant: 'info' });
  // TODO: Implementar modal de edição de fluxo
}

function openTemplateModal(templateId = null) {
  showToast({ title: 'Em desenvolvimento', message: 'Editor de templates será implementado na próxima fase!', variant: 'info' });
  // TODO: Implementar modal de edição de template
}

