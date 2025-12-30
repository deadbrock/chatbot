const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const {
  getTicketMessages,
  sendMessage,
  markAsRead,
  reactToMessage,
  toggleStar,
  deleteMessage,
  getHistory,
  uploadFile,
  downloadFile,
  getTicketAttachments,
  getStorageStats
} = require('../controllers/chatController');

/**
 * Configuração do Multer para upload de arquivos
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Criar pasta uploads se não existir
    const uploadDir = path.join(__dirname, '../../uploads/chat');
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Gerar nome único
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Filtro de tipos de arquivo
const fileFilter = (req, file, cb) => {
  // Tipos permitidos
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-rar-compressed',
    'text/plain'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

/**
 * Rotas de Chat em Tempo Real
 * Todas as rotas requerem autenticação
 */

// ==================== MENSAGENS ====================

// Listar mensagens de um ticket
router.get('/tickets/:ticketId/messages', authenticate, getTicketMessages);

// Enviar mensagem
router.post('/messages', authenticate, sendMessage);

// Marcar mensagens como lidas
router.post('/messages/read', authenticate, markAsRead);

// Adicionar reação
router.post('/messages/:messageId/react', authenticate, reactToMessage);

// Favoritar/desfavoritar mensagem
router.post('/messages/:messageId/star', authenticate, toggleStar);

// Deletar mensagem
router.delete('/messages/:messageId', authenticate, deleteMessage);

// Buscar histórico
router.get('/history', authenticate, getHistory);

// ==================== ANEXOS ====================

// Upload de arquivo
router.post('/upload', authenticate, upload.single('file'), uploadFile);

// Download de arquivo
router.get('/attachments/:id/download', authenticate, downloadFile);

// Listar anexos de um ticket
router.get('/tickets/:ticketId/attachments', authenticate, getTicketAttachments);

// Estatísticas de armazenamento
router.get('/storage/stats', authenticate, getStorageStats);

module.exports = router;

