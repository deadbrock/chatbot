const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'agent', 'viewer'),
    defaultValue: 'agent'
  },
  department: {
    type: DataTypes.STRING
  },
  departmentId: {
    type: DataTypes.STRING
  },
  phone: {
    type: DataTypes.STRING
  },
  avatar: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('online', 'offline', 'busy', 'away'),
    defaultValue: 'offline'
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE
  },
  stats: {
    type: DataTypes.TEXT,
    get() {
      const rawValue = this.getDataValue('stats');
      return rawValue ? JSON.parse(rawValue) : {
        ticketsHandled: 0,
        averageRating: 0
      };
    },
    set(value) {
      this.setDataValue('stats', JSON.stringify(value));
    }
  }
});

// Hook para hash de senha antes de salvar
User.beforeCreate(async (user) => {
  if (user.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

User.beforeUpdate(async (user) => {
  if (user.changed('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
});

// Métodos
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.comparePassword = async function(candidatePassword) {
  // Se a senha ainda estiver em texto puro (banco antigo)
  if (!this.password.startsWith('$2a$') &&
      !this.password.startsWith('$2b$') &&
      !this.password.startsWith('$2y$')) {

    if (candidatePassword === this.password) {

      // Atualiza automaticamente para bcrypt
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(candidatePassword, salt);
      await this.save();

      return true;
    }

    return false;
  }

  // Senha já criptografada
  return await bcrypt.compare(candidatePassword, this.password);
};
  
// Métodos estáticos
User.getByEmail = async function(email) {
  return await this.findOne({
    where: {
      email,
      active: true
    }
  });
};

User.getAvailableAgents = async function(departmentId = null) {
  const where = {
    active: true,
    status: 'online',
    role: { [Op.in]: ['agent', 'manager'] }
  };
  
  if (departmentId) {
    where.departmentId = departmentId;
  }
  
  return await this.findAll({ where });
};

User.prototype.updateStatus = async function(status) {
  const allowed = ['online', 'offline', 'busy', 'away'];
  if (!allowed.includes(status)) {
    throw new Error('Status inválido');
  }

  this.status = status;
  if (status === 'online') {
    this.lastLogin = new Date();
  }

  return this.save();
};

module.exports = User;

