const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

router.get('/me', auth, userController.getMe);
router.put('/me', auth, uploadAvatar, userController.updateMe);
router.get('/notifications', auth, userController.getNotifications);
router.put('/notifications/:id/read', auth, userController.markNotificationRead);
router.put('/notifications/read-all', auth, userController.markAllNotificationsRead);
router.delete('/notifications/:id', auth, userController.deleteNotification);
router.delete('/notifications', auth, userController.clearAllNotifications);

module.exports = router;
