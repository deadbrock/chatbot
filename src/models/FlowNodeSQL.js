const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Nodes de Fluxo
 * Biblioteca de tipos de nodes disponíveis no editor visual
 */
const FlowNode = sequelize.define('FlowNode', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Tipo único do node (ex: send_message, wait_response)'
  },
  
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome exibido'
  },
  
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Descrição do node'
  },
  
  // Categoria
  category: {
    type: DataTypes.ENUM(
      'trigger',
      'message',
      'action',
      'condition',
      'integration',
      'data',
      'utility',
      'ai',
      'custom'
    ),
    allowNull: false,
    comment: 'Categoria do node'
  },
  
  // Visual
  icon: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Ícone do node (Bootstrap Icons)'
  },
  
  color: {
    type: DataTypes.STRING,
    defaultValue: '#667eea',
    comment: 'Cor principal (hex)'
  },
  
  // Configuração
  config: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Configuração padrão do node'
  },
  
  // Inputs (entradas)
  inputs: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Pontos de entrada (handles)'
  },
  // Exemplo: [{ id: 'in', label: 'Entrada', type: 'default' }]
  
  // Outputs (saídas)
  outputs: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Pontos de saída (handles)'
  },
  // Exemplo: [{ id: 'success', label: 'Sucesso' }, { id: 'error', label: 'Erro' }]
  
  // Campos configuráveis
  fields: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Campos de configuração do node'
  },
  // Exemplo: [
  //   { name: 'message', type: 'textarea', label: 'Mensagem', required: true },
  //   { name: 'delay', type: 'number', label: 'Delay (segundos)', default: 0 }
  // ]
  
  // Validação
  validationRules: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Regras de validação'
  },
  
  // Comportamento
  behavior: {
    type: DataTypes.JSON,
    defaultValue: {
      canHaveMultipleInputs: false,
      canHaveMultipleOutputs: true,
      isAsync: false,
      maxExecutionTime: 30000
    },
    comment: 'Comportamento do node'
  },
  
  // Execução
  executionHandler: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome do handler de execução (código)'
  },
  
  // Ajuda
  helpText: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Texto de ajuda'
  },
  
  example: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Exemplo de configuração'
  },
  
  documentation: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL da documentação'
  },
  
  // Status
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Node ativo/disponível'
  },
  
  isBeta: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Recurso em beta'
  },
  
  isDeprecated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Node obsoleto'
  },
  
  replacedBy: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Tipo do node que substitui este'
  },
  
  // Estatísticas
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Número de vezes usado'
  },
  
  // Permissões
  requiredRole: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Papel necessário para usar este node'
  },
  
  requiredPermission: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Permissão necessária'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais'
  },
  
  // Auditoria
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Criado por (user ID)'
  }
}, {
  tableName: 'flow_nodes',
  timestamps: true,
  indexes: [
    { fields: ['type'], unique: true },
    { fields: ['category'] },
    { fields: ['isActive'] }
  ]
});

/**
 * Incrementa contador de uso
 */
FlowNode.prototype.incrementUsage = async function() {
  await this.update({ usageCount: this.usageCount + 1 });
};

/**
 * Inicializa nodes padrão
 */
FlowNode.initializeDefaults = async function() {
  const defaults = [
    // TRIGGER
    {
      type: 'start',
      name: 'Início',
      description: 'Ponto de início do fluxo',
      category: 'trigger',
      icon: 'play-circle',
      color: '#28a745',
      inputs: [],
      outputs: [{ id: 'out', label: 'Saída' }],
      fields: [],
      behavior: {
        canHaveMultipleInputs: false,
        canHaveMultipleOutputs: true,
        isAsync: false
      }
    },
    
    // MESSAGES
    {
      type: 'send_message',
      name: 'Enviar Mensagem',
      description: 'Envia uma mensagem de texto',
      category: 'message',
      icon: 'chat-left-text',
      color: '#667eea',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [
        { id: 'success', label: 'Sucesso' },
        { id: 'error', label: 'Erro' }
      ],
      fields: [
        {
          name: 'message',
          type: 'textarea',
          label: 'Mensagem',
          placeholder: 'Digite a mensagem...',
          required: true
        },
        {
          name: 'delay',
          type: 'number',
          label: 'Delay (segundos)',
          default: 0,
          min: 0,
          max: 300
        }
      ],
      executionHandler: 'sendMessage'
    },
    {
      type: 'wait_response',
      name: 'Aguardar Resposta',
      description: 'Aguarda resposta do usuário',
      category: 'message',
      icon: 'hourglass-split',
      color: '#ffc107',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [
        { id: 'received', label: 'Resposta Recebida' },
        { id: 'timeout', label: 'Timeout' }
      ],
      fields: [
        {
          name: 'timeout',
          type: 'number',
          label: 'Timeout (segundos)',
          default: 300,
          min: 10,
          max: 3600
        },
        {
          name: 'saveAs',
          type: 'text',
          label: 'Salvar resposta como',
          placeholder: 'nome_variavel'
        }
      ],
      executionHandler: 'waitResponse'
    },
    
    // CONDITIONS
    {
      type: 'condition',
      name: 'Condição',
      description: 'Decide o caminho baseado em condições',
      category: 'condition',
      icon: 'arrows-split',
      color: '#17a2b8',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [
        { id: 'true', label: 'Verdadeiro' },
        { id: 'false', label: 'Falso' }
      ],
      fields: [
        {
          name: 'variable',
          type: 'text',
          label: 'Variável',
          required: true
        },
        {
          name: 'operator',
          type: 'select',
          label: 'Operador',
          options: [
            { value: 'equals', label: 'Igual a' },
            { value: 'not_equals', label: 'Diferente de' },
            { value: 'contains', label: 'Contém' },
            { value: 'greater', label: 'Maior que' },
            { value: 'less', label: 'Menor que' }
          ],
          required: true
        },
        {
          name: 'value',
          type: 'text',
          label: 'Valor',
          required: true
        }
      ],
      executionHandler: 'evaluateCondition'
    },
    
    // ACTIONS
    {
      type: 'set_variable',
      name: 'Definir Variável',
      description: 'Define ou atualiza uma variável',
      category: 'data',
      icon: 'variable',
      color: '#6f42c1',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [{ id: 'out', label: 'Saída' }],
      fields: [
        {
          name: 'variable',
          type: 'text',
          label: 'Nome da Variável',
          required: true
        },
        {
          name: 'value',
          type: 'text',
          label: 'Valor',
          required: true
        }
      ],
      executionHandler: 'setVariable'
    },
    {
      type: 'delay',
      name: 'Aguardar',
      description: 'Aguarda um tempo específico',
      category: 'utility',
      icon: 'clock',
      color: '#fd7e14',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [{ id: 'out', label: 'Saída' }],
      fields: [
        {
          name: 'duration',
          type: 'number',
          label: 'Duração (segundos)',
          default: 5,
          min: 1,
          max: 3600,
          required: true
        }
      ],
      executionHandler: 'delay'
    },
    {
      type: 'http_request',
      name: 'Requisição HTTP',
      description: 'Faz uma requisição HTTP',
      category: 'integration',
      icon: 'globe',
      color: '#20c997',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [
        { id: 'success', label: 'Sucesso' },
        { id: 'error', label: 'Erro' }
      ],
      fields: [
        {
          name: 'method',
          type: 'select',
          label: 'Método',
          options: [
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'DELETE', label: 'DELETE' }
          ],
          required: true
        },
        {
          name: 'url',
          type: 'text',
          label: 'URL',
          required: true
        },
        {
          name: 'headers',
          type: 'json',
          label: 'Headers (JSON)',
          placeholder: '{"Content-Type": "application/json"}'
        },
        {
          name: 'body',
          type: 'json',
          label: 'Body (JSON)'
        }
      ],
      executionHandler: 'httpRequest'
    },
    
    // AI
    {
      type: 'ai_classify',
      name: 'Classificar com IA',
      description: 'Classifica a mensagem usando IA',
      category: 'ai',
      icon: 'robot',
      color: '#e83e8c',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [], // Dinâmico baseado nas categorias
      fields: [
        {
          name: 'categories',
          type: 'tags',
          label: 'Categorias',
          placeholder: 'Adicione categorias...',
          required: true
        }
      ],
      executionHandler: 'aiClassify',
      isBeta: true
    },
    
    // END
    {
      type: 'end',
      name: 'Fim',
      description: 'Finaliza o fluxo',
      category: 'utility',
      icon: 'stop-circle',
      color: '#dc3545',
      inputs: [{ id: 'in', label: 'Entrada' }],
      outputs: [],
      fields: [
        {
          name: 'message',
          type: 'textarea',
          label: 'Mensagem Final (opcional)',
          placeholder: 'Obrigado por usar nosso serviço!'
        }
      ],
      executionHandler: 'end'
    }
  ];
  
  for (const def of defaults) {
    await FlowNode.findOrCreate({
      where: { type: def.type },
      defaults: def
    });
  }
  
  console.log('✅ Nodes padrão inicializados');
};

module.exports = FlowNode;

