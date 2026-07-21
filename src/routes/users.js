const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkRole } = require('../middleware/auth');
const usersController = require('../controllers/usersController');
const { AVATAR_DIR, ensureAvatarDir } = require('../services/userProfileService');

ensureAvatarDir();

const avatarStorage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureAvatarDir();
    cb(null, AVATAR_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, `user-${req.user.id}-${Date.now()}${safeExt}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Formato inválido. Use JPG, PNG, WEBP ou GIF.'));
  }
});

// público
router.post('/login', usersController.login);

// protegido
router.use(authMiddleware);

router.get('/me', usersController.getProfile);
router.put('/me', usersController.updateProfile);
router.post('/me/avatar', avatarUpload.single('avatar'), usersController.uploadAvatar);
router.delete('/me/avatar', usersController.removeAvatar);

router.get('/departments/list', usersController.listDepartments);
router.get('/agents/available', usersController.availableAgents);
router.patch('/:id/status', usersController.updateStatus);

// gestão de usuários — admin e gestor
router.get('/', checkRole('admin', 'manager'), usersController.list);
router.get('/:id', checkRole('admin', 'manager'), usersController.getById);
router.post('/', checkRole('admin', 'manager'), usersController.create);
router.put('/:id', checkRole('admin', 'manager'), usersController.update);
router.delete('/:id', checkRole('admin', 'manager'), usersController.remove);

module.exports = router;
