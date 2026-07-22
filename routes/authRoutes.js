const express = require('express');
const router = express.Router();
const { registerAdmin, login, requestPasswordRecovery, processPasswordReset } = require('../controllers/authController');

router.post('/register-admin', registerAdmin);
router.post('/login', login);
router.post('/forgot-password', requestPasswordRecovery);
router.post('/reset-password', processPasswordReset);

module.exports = router;
