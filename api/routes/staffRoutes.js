const express = require('express');
const router = express.Router();
const { registerStaff, getAllStaff } = require('../controllers/staffController');

router.post('/register', registerStaff);
router.get('/', getAllStaff);

module.exports = router;
