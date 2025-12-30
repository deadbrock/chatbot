const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  data: {
    userName: String,
    userPhone: String,
    welcomed: {
      type: Boolean,
      default: false
    },
    currentDepartment: String,
    currentFlow: String,
    awaitingInput: String,
    suggestedDepartment: String,
    lastInteraction: Date,
    interactionCount: {
      type: Number,
      default: 0
    },
    metadata: mongoose.Schema.Types.Mixed
  },
  
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  
  expiresAt: {
    type: Date,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// TTL Index - Remove sessões expiradas automaticamente
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware
sessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Atualizar expiração (24 horas de inatividade)
  if (!this.expiresAt || this.isModified('data.lastInteraction')) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Métodos
sessionSchema.methods.updateInteraction = function() {
  this.data.lastInteraction = new Date();
  this.data.interactionCount += 1;
  return this.save();
};

sessionSchema.methods.setFlow = function(flow) {
  this.data.currentFlow = flow;
  return this.save();
};

sessionSchema.methods.clearFlow = function() {
  this.data.currentFlow = null;
  this.data.awaitingInput = null;
  return this.save();
};

sessionSchema.methods.expire = function() {
  this.active = false;
  this.expiresAt = new Date();
  return this.save();
};

// Statics
sessionSchema.statics.getActiveSession = function(userId) {
  return this.findOne({ userId, active: true });
};

sessionSchema.statics.getActiveSessions = function() {
  return this.find({ active: true }).sort({ updatedAt: -1 });
};

sessionSchema.statics.cleanExpiredSessions = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

module.exports = mongoose.model('Session', sessionSchema);

