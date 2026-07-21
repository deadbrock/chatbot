const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conversation = sequelize.define('Conversation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  contactId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  whatsappJid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userPhone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  displayName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'archived'),
    defaultValue: 'active'
  },
  activeTicketId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  lastMessageAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    defaultValue: 'inbound'
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {}
  }
}, {
  tableName: 'conversations',
  timestamps: true,
  indexes: [
    { fields: ['whatsappJid'], unique: true },
    { fields: ['contactId'] },
    { fields: ['lastMessageAt'] },
    { fields: ['activeTicketId'] },
    { fields: ['status'] }
  ]
});

module.exports = Conversation;
