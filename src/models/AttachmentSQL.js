const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;

/**
 * Modelo de Anexos
 * Gerencia arquivos de mídia anexados às mensagens
 */
const Attachment = sequelize.define('Attachment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // Relacionamentos
  messageId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Mensagem associada'
  },
  
  ticketId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Ticket associado'
  },
  
  // Arquivo
  filename: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Nome original do arquivo'
  },
  
  storedFilename: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Nome do arquivo armazenado (UUID)'
  },
  
  filepath: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Caminho completo do arquivo'
  },
  
  // Tipo
  mimetype: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Tipo MIME do arquivo'
  },
  
  mediaType: {
    type: DataTypes.ENUM('image', 'video', 'audio', 'voice', 'document', 'sticker', 'other'),
    allowNull: false,
    comment: 'Categoria do arquivo'
  },
  
  // Tamanho
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Tamanho em bytes'
  },
  
  sizeFormatted: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Tamanho formatado (ex: 2.5 MB)'
  },
  
  // Dimensões (imagem/vídeo)
  width: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Largura (pixels)'
  },
  
  height: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Altura (pixels)'
  },
  
  // Duração (áudio/vídeo)
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duração em segundos'
  },
  
  durationFormatted: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Duração formatada (ex: 03:45)'
  },
  
  // Thumbnail
  thumbnailPath: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Caminho do thumbnail'
  },
  
  thumbnailBase64: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Thumbnail em base64 (para preview rápido)'
  },
  
  // URLs
  url: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL pública do arquivo'
  },
  
  downloadUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL de download'
  },
  
  // Status
  status: {
    type: DataTypes.ENUM('uploading', 'processing', 'ready', 'failed', 'deleted'),
    defaultValue: 'uploading',
    comment: 'Status do anexo'
  },
  
  // Processamento
  isProcessed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Indica se foi processado (thumbnail, compressão, etc)'
  },
  
  processingError: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Erro no processamento (se houver)'
  },
  
  // Segurança
  checksum: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Hash MD5 do arquivo (para verificação de integridade)'
  },
  
  isVirus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Marcado como vírus (scan antivírus)'
  },
  
  // Downloads
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Contador de downloads'
  },
  
  lastDownloadedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Último download'
  },
  
  // Expiração
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Data de expiração do arquivo'
  },
  
  // Metadados
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {},
    comment: 'Metadados adicionais (EXIF, etc)'
  },
  
  // Auditoria
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Usuário que fez upload'
  }
}, {
  tableName: 'attachments',
  timestamps: true,
  indexes: [
    { fields: ['messageId'] },
    { fields: ['ticketId'] },
    { fields: ['storedFilename'], unique: true },
    { fields: ['mediaType'] },
    { fields: ['status'] },
    { fields: ['createdAt'] }
  ],
  hooks: {
    beforeCreate: (attachment) => {
      // Calcular tamanho formatado
      attachment.sizeFormatted = formatFileSize(attachment.size);
      
      // Determinar mediaType baseado no mimetype se não foi definido
      if (!attachment.mediaType && attachment.mimetype) {
        attachment.mediaType = getMediaTypeFromMimetype(attachment.mimetype);
      }
    },
    beforeUpdate: (attachment) => {
      if (attachment.changed('size')) {
        attachment.sizeFormatted = formatFileSize(attachment.size);
      }
      if (attachment.changed('duration') && attachment.duration) {
        attachment.durationFormatted = formatDuration(attachment.duration);
      }
    }
  }
});

/**
 * Marca anexo como pronto
 */
Attachment.prototype.markAsReady = async function() {
  await this.update({
    status: 'ready',
    isProcessed: true
  });
};

/**
 * Marca anexo como falho
 */
Attachment.prototype.markAsFailed = async function(error) {
  await this.update({
    status: 'failed',
    processingError: error
  });
};

/**
 * Registra download
 */
Attachment.prototype.recordDownload = async function() {
  await this.update({
    downloadCount: this.downloadCount + 1,
    lastDownloadedAt: new Date()
  });
};

/**
 * Gera URL de acesso
 */
Attachment.prototype.generateUrl = function(baseUrl) {
  return `${baseUrl}/api/attachments/${this.id}`;
};

/**
 * Gera URL de download
 */
Attachment.prototype.generateDownloadUrl = function(baseUrl) {
  return `${baseUrl}/api/attachments/${this.id}/download`;
};

/**
 * Deleta arquivo físico
 */
Attachment.prototype.deleteFile = async function() {
  try {
    // Deletar arquivo principal
    if (this.filepath) {
      await fs.unlink(this.filepath);
    }
    
    // Deletar thumbnail
    if (this.thumbnailPath) {
      await fs.unlink(this.thumbnailPath);
    }
    
    // Atualizar status
    await this.update({ status: 'deleted' });
    
    return true;
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    return false;
  }
};

/**
 * Verifica se o arquivo existe fisicamente
 */
Attachment.prototype.fileExists = async function() {
  try {
    await fs.access(this.filepath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Busca anexos de uma mensagem
 */
Attachment.findByMessage = async function(messageId) {
  return await Attachment.findAll({
    where: { messageId, status: { [sequelize.Sequelize.Op.ne]: 'deleted' } },
    order: [['createdAt', 'ASC']]
  });
};

/**
 * Busca anexos de um ticket
 */
Attachment.findByTicket = async function(ticketId, options = {}) {
  const { mediaType, limit, offset } = options;
  
  const where = {
    ticketId,
    status: 'ready'
  };
  
  if (mediaType) {
    where.mediaType = mediaType;
  }
  
  return await Attachment.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset
  });
};

/**
 * Calcula espaço total usado
 */
Attachment.getTotalSize = async function(filters = {}) {
  const result = await Attachment.findAll({
    where: {
      status: 'ready',
      ...filters
    },
    attributes: [
      [sequelize.fn('SUM', sequelize.col('size')), 'totalSize'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalCount']
    ],
    raw: true
  });
  
  return {
    totalSize: parseInt(result[0]?.totalSize || 0),
    totalSizeFormatted: formatFileSize(parseInt(result[0]?.totalSize || 0)),
    totalCount: parseInt(result[0]?.totalCount || 0)
  };
};

/**
 * Limpa anexos expirados
 */
Attachment.cleanExpired = async function() {
  const expired = await Attachment.findAll({
    where: {
      expiresAt: {
        [sequelize.Sequelize.Op.lt]: new Date()
      },
      status: { [sequelize.Sequelize.Op.ne]: 'deleted' }
    }
  });
  
  let deletedCount = 0;
  
  for (const attachment of expired) {
    const success = await attachment.deleteFile();
    if (success) deletedCount++;
  }
  
  return deletedCount;
};

// Helpers

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getMediaTypeFromMimetype(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) {
    // PTT (Push to Talk) é um tipo especial de áudio
    return mimetype.includes('ogg') ? 'voice' : 'audio';
  }
  if (mimetype.startsWith('application/pdf') || 
      mimetype.startsWith('application/msword') ||
      mimetype.startsWith('application/vnd')) {
    return 'document';
  }
  return 'other';
}

module.exports = Attachment;

