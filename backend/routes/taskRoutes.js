const express = require('express');
const router = express.Router();
const { assignTask, getTasks, completeTask } = require('../controllers/taskController');

router.post('/assign', assignTask);
router.post('/complete', completeTask);
router.post('/:taskId/complete', completeTask);
router.get('/', getTasks);

module.exports = router;
