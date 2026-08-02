const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/', staffController.getStaff);
router.post('/register', staffController.registerStaff);
router.delete('/:id', staffController.deleteStaff);

module.exports = router;
