const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badgeController');
const { auth } = require('../middleware/auth');

router.get('/', auth, badgeController.getUserBadges);

module.exports = router;
