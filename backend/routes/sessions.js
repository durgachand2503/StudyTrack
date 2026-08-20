const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');
const { auth } = require('../middleware/auth');
const { sessionValidation } = require('../middleware/validation');

router.get('/', auth, sessionController.getSessions);
router.get('/today', auth, sessionController.getTodaySessions);
router.post('/', auth, sessionValidation, sessionController.createSession);

module.exports = router;
