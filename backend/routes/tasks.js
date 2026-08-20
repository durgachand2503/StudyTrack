const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { auth } = require('../middleware/auth');
const { taskValidation } = require('../middleware/validation');

router.get('/', auth, taskController.getTasks);
router.get('/:id', auth, taskController.getTask);
router.post('/', auth, taskValidation, taskController.createTask);
router.put('/:id', auth, taskController.updateTask);
router.delete('/:id', auth, taskController.deleteTask);
router.put('/:id/complete', auth, taskController.completeTask);
router.put('/:id/reopen', auth, taskController.reopenTask);

module.exports = router;
