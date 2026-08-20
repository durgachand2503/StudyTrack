const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { auth } = require('../middleware/auth');
const { assignmentValidation } = require('../middleware/validation');
const { uploadAssignment } = require('../middleware/upload');

router.get('/', auth, assignmentController.getAssignments);
router.get('/:id', auth, assignmentController.getAssignment);
router.post('/', auth, assignmentValidation, assignmentController.createAssignment);
router.put('/:id', auth, assignmentController.updateAssignment);
router.delete('/:id', auth, assignmentController.deleteAssignment);
router.post('/:id/submit', auth, uploadAssignment, assignmentController.submitAssignment);
router.get('/:id/submissions', auth, assignmentController.getSubmissions);
router.put('/:assignmentId/submissions/:submissionId/grade', auth, assignmentController.gradeSubmission);

module.exports = router;
