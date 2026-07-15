const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkRole } = require('../middleware/auth');
const usersController = require('../controllers/usersController');

// público
router.post('/login', usersController.login);

// protegido
router.use(authMiddleware);
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

