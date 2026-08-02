const express = require('express');
const router = express.Router();
const { assignTask, getTasks } = require('../controllers/taskController');

router.post('/assign', assignTask);
router.get('/', getTasks);

module.exports = router;
