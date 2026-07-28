const express = require('express');
const router = express.Router();
const {
  registerAdmin,
  login,
  getAdmins,
  approveAdmin,
  rejectAdmin,
  requestPasswordRecovery,
  getPasswordResetRequests,
  processPasswordReset
} = require('../controllers/authController');

router.post('/register', registerAdmin);
router.post('/register-admin', registerAdmin);
router.post('/login', login);

// Superadmin Admin Management Routes
router.get('/admins', getAdmins);
router.post('/admins/:userId/approve', approveAdmin);
router.post('/admins/:userId/reject', rejectAdmin);

// Password Recovery Routes
router.post('/forgot-password', requestPasswordRecovery);
router.get('/password-requests', getPasswordResetRequests);
router.post('/reset-password', processPasswordReset);

module.exports = router;
