const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Modelo de Relacionamento Ticket-Tag (Many-to-Many)
 * Um ticket pode ter várias tags e uma tag pode estar em vários tickets
 */
const TicketTag = sequelize.define('TicketTag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  ticketId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID do ticket',
  },
  tagId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'ID da tag',
  },
  addedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID do usuário que adicionou a tag',
  },
}, {
  tableName: 'ticket_tags',
  timestamps: true,
  indexes: [
    { fields: ['ticketId'] },
    { fields: ['tagId'] },
    { fields: ['ticketId', 'tagId'], unique: true }, // Não permite duplicatas
  ],
});

module.exports = TicketTag;

