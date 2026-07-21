const express = require('express');
const router = express.Router();
const conversationsController = require('../controllers/conversationsController');

/**
 * Inbox de Conversas WhatsApp (modelo híbrido — sem ticket até aceitar atendimento)
 */

router.get('/', conversationsController.list);
router.get('/pending', conversationsController.pending);
router.get('/:id', conversationsController.get);
router.post('/:id/accept', conversationsController.accept);
router.post('/:id/finish', conversationsController.finish);
router.post('/:id/save-contact', conversationsController.saveContact);

module.exports = router;
