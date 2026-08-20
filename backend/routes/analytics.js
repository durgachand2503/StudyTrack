const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');

router.get('/study-stats', auth, analyticsController.getStudyStats);
router.get('/subject-breakdown', auth, analyticsController.getSubjectBreakdown);
router.get('/weekly-activity', auth, analyticsController.getWeeklyActivity);
router.get('/heatmap', auth, analyticsController.getHeatmapData);
router.get('/task-stats', auth, analyticsController.getTaskStats);
router.get('/monthly-productivity', auth, analyticsController.getMonthlyProductivity);

module.exports = router;
