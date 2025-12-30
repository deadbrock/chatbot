const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Fluxos Visuais
 * Editor visual de fluxos de automação com drag & drop
 */
const VisualFlow = sequelize.define('VisualFlow', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do fluxo'
  },
  
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Slug único (URL-friendly)'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do fluxo'
  },
  
  // Tipo
  type: {
    type: DataTypes.ENUM(
      'chatbot',
      'campaign',
      'automation',
      'workflow',
      'integration',
      'custom'
    ),
    defaultValue: 'chatbot',
    comment: 'Tipo do fluxo'
  },
  
  // Canvas
  canvas: {
    type: DataTypes.JSON,
    defaultValue: {
      zoom: 100,
      pan: { x: 0, y: 0 },
      grid: true,
      snapToGrid: true
    },
    comment: 'Configurações do canvas'
  },
  
  // Nodes
  nodes: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de nodes do fluxo'
  },
  // Exemplo: [{ id, type, position, data, config }]
  
  // Conexões entre nodes
  edges: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de conexões entre nodes'
  },
  // Exemplo: [{ id, source, target, sourceHandle, targetHandle, label }]
  
  // Variáveis do fluxo
  variables: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Variáveis disponíveis no fluxo'
  },
  // Exemplo: { userName: 'string', userAge: 'number', isActive: 'boolean' }
  
  // Trigger (gatilho)
  trigger: {
    type: DataTypes.JSON,
    defaultValue: {
      type: 'manual',
      config: {}
    },
    comment: 'Configuração do gatilho de início'
  },
  // Tipos: manual, message, keyword, schedule, webhook, event
  
  // Configurações
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      timeout: 300,
      maxRetries: 3,
      fallbackBehavior: 'end',
      logging: true
    },
    comment: 'Configurações gerais'
  },
  
  // Validação
  validationRules: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Regras de validação do fluxo'
  },
  
  validationErrors: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Erros de validação encontrados'
  },
  
  isValid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Fluxo passou na validação'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('draft', 'testing', 'active', 'paused', 'archived'),
    defaultValue: 'draft',
    comment: 'Status do fluxo'
  },
  
  // Estatísticas
  stats: {
    type: DataTypes.JSON,
    defaultValue: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageDuration: 0,
      lastExecutionAt: null
    },
    comment: 'Estatísticas de execução'
  },
  
  // Versionamento
  version: {
    type: DataTypes.STRING,
    defaultValue: '1.0.0',
    comment: 'Versão do fluxo (semver)'
  },
  
  previousVersionId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID da versão anterior'
  },
  
  changelog: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Histórico de mudanças'
  },
  
  // Template
  isTemplate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'É um template reutilizável'
  },
  
  templateCategory: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Categoria do template'
  },
  
  templateTags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Tags do template'
  },
  
  clonedFrom: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do fluxo original (se for clonado)'
  },
  
  cloneCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de clones deste fluxo'
  },
  
  // Publicação
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Publicado na biblioteca pública'
  },
  
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de publicação'
  },
  
  downloads: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de downloads (se template público)'
  },
  
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    comment: 'Avaliação média (0-5)'
  },
  
  ratingCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de avaliações'
  },
  
  // Permissões
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Visível para todos os usuários'
  },
  
  allowedUsers: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'IDs de usuários com acesso'
  },
  
  allowedRoles: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Papéis com acesso'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  thumbnail: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Thumbnail do fluxo (base64 ou URL)'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Atualizado por (user ID)'
  },
  
  lastTestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última vez que foi testado'
  },
  
  lastPublishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última publicação (ativação)'
  }
}, {
  tableName: 'visual_flows',
  timestamps: true,
  indexes: [
    { fields: ['slug'], unique: true },
    { fields: ['type'] },
    { fields: ['status'] },
    { fields: ['isTemplate'] },
    { fields: ['isPublished'] },
    { fields: ['createdBy'] },
    { fields: ['createdAt'] }
  ]
});

/**
 * Valida o fluxo
 */
VisualFlow.prototype.validate = async function() {
  const errors = [];
  
  // Verificar se tem nodes
  if (!this.nodes || this.nodes.length === 0) {
    errors.push({ type: 'error', message: 'Fluxo deve ter pelo menos um node' });
  }
  
  // Verificar se tem node de início
  const startNode = this.nodes.find(n => n.type === 'start');
  if (!startNode) {
    errors.push({ type: 'error', message: 'Fluxo deve ter um node de início' });
  }
  
  // Verificar nodes órfãos (sem conexões)
  const connectedNodeIds = new Set();
  this.edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });
  
  const orphanNodes = this.nodes.filter(n => 
    n.type !== 'start' && !connectedNodeIds.has(n.id)
  );
  
  if (orphanNodes.length > 0) {
    errors.push({
      type: 'warning',
      message: `${orphanNodes.length} node(s) órfão(s) encontrado(s)`,
      nodes: orphanNodes.map(n => n.id)
    });
  }
  
  // Verificar loops infinitos
  if (this.hasInfiniteLoop()) {
    errors.push({ type: 'error', message: 'Loop infinito detectado no fluxo' });
  }
  
  await this.update({
    validationErrors: errors,
    isValid: errors.filter(e => e.type === 'error').length === 0
  });
  
  return {
    isValid: errors.filter(e => e.type === 'error').length === 0,
    errors
  };
};

/**
 * Verifica se há loops infinitos
 */
VisualFlow.prototype.hasInfiniteLoop = function() {
  const visited = new Set();
  const recursionStack = new Set();
  
  const dfs = (nodeId) => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const outgoingEdges = this.edges.filter(e => e.source === nodeId);
    
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        if (dfs(edge.target)) return true;
      } else if (recursionStack.has(edge.target)) {
        return true; // Loop detectado
      }
    }
    
    recursionStack.delete(nodeId);
    return false;
  };
  
  const startNode = this.nodes.find(n => n.type === 'start');
  if (startNode) {
    return dfs(startNode.id);
  }
  
  return false;
};

/**
 * Adiciona node ao fluxo
 */
VisualFlow.prototype.addNode = async function(nodeData) {
  const nodes = this.nodes || [];
  nodes.push(nodeData);
  await this.update({ nodes });
  return nodeData;
};

/**
 * Remove node do fluxo
 */
VisualFlow.prototype.removeNode = async function(nodeId) {
  const nodes = (this.nodes || []).filter(n => n.id !== nodeId);
  const edges = (this.edges || []).filter(e => 
    e.source !== nodeId && e.target !== nodeId
  );
  await this.update({ nodes, edges });
};

/**
 * Adiciona conexão (edge)
 */
VisualFlow.prototype.addEdge = async function(edgeData) {
  const edges = this.edges || [];
  edges.push(edgeData);
  await this.update({ edges });
  return edgeData;
};

/**
 * Remove conexão
 */
VisualFlow.prototype.removeEdge = async function(edgeId) {
  const edges = (this.edges || []).filter(e => e.id !== edgeId);
  await this.update({ edges });
};

/**
 * Clona o fluxo
 */
VisualFlow.prototype.clone = async function(newName, userId) {
  const cloned = await VisualFlow.create({
    name: newName || `${this.name} (cópia)`,
    slug: `${this.slug}-${Date.now()}`,
    description: this.description,
    type: this.type,
    canvas: this.canvas,
    nodes: this.nodes,
    edges: this.edges,
    variables: this.variables,
    trigger: this.trigger,
    settings: this.settings,
    clonedFrom: this.id,
    createdBy: userId
  });
  
  // Incrementar contador de clones
  await this.update({ cloneCount: this.cloneCount + 1 });
  
  return cloned;
};

/**
 * Cria nova versão
 */
VisualFlow.prototype.createVersion = async function(changelog, userId) {
  const [major, minor, patch] = this.version.split('.').map(Number);
  const newVersion = `${major}.${minor}.${patch + 1}`;
  
  const changelogEntry = {
    version: newVersion,
    date: new Date(),
    userId,
    changes: changelog
  };
  
  const changelogHistory = this.changelog || [];
  changelogHistory.unshift(changelogEntry);
  
  await this.update({
    version: newVersion,
    changelog: changelogHistory.slice(0, 50), // Manter últimas 50 versões
    updatedBy: userId
  });
  
  return newVersion;
};

/**
 * Publica o fluxo (ativa)
 */
VisualFlow.prototype.publish = async function(userId) {
  // Validar antes de publicar
  const validation = await this.validate();
  
  if (!validation.isValid) {
    throw new Error('Fluxo contém erros de validação');
  }
  
  await this.update({
    status: 'active',
    isPublished: true,
    publishedAt: new Date(),
    lastPublishedAt: new Date(),
    updatedBy: userId
  });
};

/**
 * Exporta o fluxo (JSON)
 */
VisualFlow.prototype.export = function() {
  return {
    name: this.name,
    description: this.description,
    type: this.type,
    version: this.version,
    canvas: this.canvas,
    nodes: this.nodes,
    edges: this.edges,
    variables: this.variables,
    trigger: this.trigger,
    settings: this.settings,
    exportedAt: new Date()
  };
};

/**
 * Importa fluxo de JSON
 */
VisualFlow.import = async function(data, userId) {
  return await VisualFlow.create({
    name: data.name,
    slug: `imported-${Date.now()}`,
    description: data.description,
    type: data.type || 'custom',
    canvas: data.canvas,
    nodes: data.nodes,
    edges: data.edges,
    variables: data.variables,
    trigger: data.trigger,
    settings: data.settings,
    createdBy: userId
  });
};

module.exports = VisualFlow;

