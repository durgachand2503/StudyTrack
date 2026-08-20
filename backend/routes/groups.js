const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { auth } = require('../middleware/auth');
const { groupValidation } = require('../middleware/validation');

router.get('/', auth, groupController.getGroups);
router.get('/:id', auth, groupController.getGroup);
router.post('/', auth, groupValidation, groupController.createGroup);
router.put('/:id', auth, groupController.updateGroup);
router.delete('/:id', auth, groupController.deleteGroup);
router.post('/:id/join', auth, groupController.joinGroup);
router.post('/:id/leave', auth, groupController.leaveGroup);
router.delete('/:id/members/:userId', auth, groupController.removeMember);
router.get('/:id/messages', auth, groupController.getGroupMessages);
router.delete('/:id/messages/:messageId', auth, groupController.deleteGroupMessage);
router.delete('/:id/messages', auth, groupController.deleteGroupMessages);

module.exports = router;
