const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Contatos
 * Gerenciamento completo de contatos do WhatsApp
 */
const Contact = sequelize.define('Contact', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Identificação
  whatsappId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'ID do WhatsApp (ex: 5511999999999@c.us)'
  },
  
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome do contato'
  },
  
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Número de telefone formatado'
  },
  
  // Informações adicionais
  profilePicUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL da foto de perfil'
  },
  
  about: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Sobre/Bio do contato'
  },
  
  // Dados pessoais
  birthDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Data de nascimento'
  },
  
  cpf: {
    type: DataTypes.STRING(14),
    allowNull: true,
    comment: 'CPF do contato'
  },
  
  cnpj: {
    type: DataTypes.STRING(18),
    allowNull: true,
    comment: 'CNPJ (se empresa)'
  },
  
  // Endereço
  address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  
  state: {
    type: DataTypes.STRING(2),
    allowNull: true
  },
  
  zipCode: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  
  country: {
    type: DataTypes.STRING,
    defaultValue: 'Brasil'
  },
  
  // Informações comerciais
  company: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nome da empresa'
  },
  
  position: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Cargo/Posição'
  },

  contract: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Contrato do colaborador (facilities/operacional)'
  },
  
  // Categorização
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Array de tags'
  },
  
  category: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Categoria do contato (Cliente, Lead, Fornecedor, etc)'
  },
  
  // Status
  isBlocked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Contato bloqueado'
  },
  
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    comment: 'Contato ativo'
  },
  
  // Estatísticas
  ticketsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Total de tickets'
  },
  
  lastInteraction: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Última interação'
  },
  
  // Campos personalizados
  customFields: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Campos personalizados (chave-valor)'
  },
  
  // Notas
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Observações sobre o contato'
  },
  
  // Origem
  source: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Origem do contato (WhatsApp, Importação, Manual, etc)'
  },
  
  // Responsável
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário responsável'
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
    allowNull: true
  },
  
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'contacts',
  timestamps: true,
  indexes: [
    { fields: ['whatsappId'], unique: true },
    { fields: ['phone'] },
    { fields: ['email'] },
    { fields: ['name'] },
    { fields: ['category'] },
    { fields: ['isActive'] },
    { fields: ['assignedTo'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Contact;

