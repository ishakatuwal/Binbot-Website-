const express = require('express');
const router = express.Router();
const {
  registerAdmin,
  login,
  getAdmins,
  resetAdminPassword,
  toggleSuspendAdmin,
  deleteAdmin,
  getAuditLogs
} = require('../controllers/authController');

const checkSuperadmin = require('../../backend/middleware/auth');

router.post('/register', checkSuperadmin, registerAdmin);
router.post('/login', login);
router.get('/admins', checkSuperadmin, getAdmins);
router.post('/admins/:userId/reset-password', checkSuperadmin, resetAdminPassword);
router.post('/admins/:userId/suspend', checkSuperadmin, toggleSuspendAdmin);
router.delete('/admins/:userId', checkSuperadmin, deleteAdmin);
router.get('/audit-logs', checkSuperadmin, getAuditLogs);

module.exports = router;
