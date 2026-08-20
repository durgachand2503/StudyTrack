const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channelController');
const { auth } = require('../middleware/auth');
const { channelValidation } = require('../middleware/validation');

router.get('/', auth, channelController.getChannels);
router.get('/:id', auth, channelController.getChannel);
router.post('/', auth, channelValidation, channelController.createChannel);
router.put('/:id', auth, channelController.updateChannel);
router.delete('/:id', auth, channelController.deleteChannel);
router.post('/:id/join', auth, channelController.joinChannel);
router.post('/:id/leave', auth, channelController.leaveChannel);
router.post('/:id/resources', auth, channelController.addResource);
router.delete('/:id/resources/:resourceId', auth, channelController.removeResource);
router.get('/:id/messages', auth, channelController.getChannelMessages);
router.delete('/:id/messages/:messageId', auth, channelController.deleteChannelMessage);
router.delete('/:id/messages', auth, channelController.deleteChannelMessages);

module.exports = router;
