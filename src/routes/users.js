const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const usersController = require('../controllers/usersController');

// público
router.post('/login', usersController.login);

// protegido
router.use(authMiddleware);
router.get('/', usersController.list);
router.get('/agents/available', usersController.availableAgents);
router.post('/', usersController.create);
router.patch('/:id/status', usersController.updateStatus);

module.exports = router;

