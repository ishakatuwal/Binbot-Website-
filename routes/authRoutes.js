const express = require('express');
const router = express.Router();
const {
  registerAdmin,
  login,
  getAdmins,
  resetAdminPassword,
  toggleSuspendAdmin,
  deleteAdmin,
  getAuditLogs,
  requestPasswordRecovery,
  getPasswordResetRequests,
  processPasswordReset
} = require('../controllers/authController');

router.post('/register', registerAdmin);
router.post('/register-admin', registerAdmin);
router.post('/login', login);

// Admin Governance & Audit Log Endpoints (Superadmin)
router.get('/admins', getAdmins);
router.post('/admins/:userId/reset-password', resetAdminPassword);
router.post('/admins/:userId/suspend', toggleSuspendAdmin);
router.delete('/admins/:userId', deleteAdmin);
router.get('/audit-logs', getAuditLogs);

// Legacy password reset ticket endpoints
router.post('/forgot-password', requestPasswordRecovery);
router.get('/password-requests', getPasswordResetRequests);
router.post('/reset-password', processPasswordReset);

module.exports = router;
