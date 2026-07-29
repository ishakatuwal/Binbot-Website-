/**
 * backend/controllers/authController.js
 * Handles Auth, Admin Registration, Bcrypt Encryption, Superadmin Management, and Audit Logging.
 */

const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const AuditLog = require('../models/AuditLog');

// 1. Superadmin Registers New Admin Account (Story 2 & Story 15)
exports.registerAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password, username, name } = req.body;

    const adminFirstName = firstName || (name ? name.split(' ')[0] : 'Admin');
    const adminLastName = lastName || (name && name.split(' ').length > 1 ? name.split(' ').slice(1).join(' ') : 'User');
    const adminFullName = `${adminFirstName} ${adminLastName}`.trim();
    const adminUsername = username || email.split('@')[0];

    if (!email || !password) {
      return res.status(400).json({ error: 'First Name, Last Name, Email, and Password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const existingUser = await User.findOne({
      $or: [{ username: adminUsername.toLowerCase() }, { email: email.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists in database' });
    }

    // Create Admin user (password is automatically encrypted via pre-save hook in User model)
    const newAdmin = await User.create({
      firstName: adminFirstName,
      lastName: adminLastName,
      fullName: adminFullName,
      username: adminUsername.toLowerCase(),
      email: email.toLowerCase(),
      password,
      role: 'Admin',
      status: 'approved',
      isSuspended: false
    });

    // Record action in Audit Log (Story 15)
    await AuditLog.create({
      action: 'CREATE_ADMIN',
      performedBy: 'superadmin',
      targetItem: newAdmin.email,
      details: `Created new admin account: ${newAdmin.fullName} (${newAdmin.email})`
    });

    res.status(201).json({
      message: 'Profile Successfully Created',
      user: {
        id: newAdmin._id,
        firstName: newAdmin.firstName,
        lastName: newAdmin.lastName,
        fullName: newAdmin.fullName,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. User Login (Story 3) - Validates bcrypt credentials & inactivity timeout
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Credentials Invalid' });
    }

    const user = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Credentials Invalid' });
    }

    // Verify bcrypt password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credentials Invalid' });
    }

    // Check account suspension status (Story 15)
    if (user.isSuspended) {
      return res.status(403).json({
        error: 'Account Suspended: Access denied by Superadmin. Session terminated.',
        isSuspended: true
      });
    }

    // Calculate 30-minute session expiry (Story 3)
    const sessionExpiresAt = Date.now() + 30 * 60 * 1000;

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        sessionExpiresAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Superadmin: Fetch All Admins (Story 15)
exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'Admin' }).sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Superadmin: Reset Admin Password (Story 13 & 15)
exports.resetAdminPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const admin = await User.findById(userId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    admin.password = newPassword; // Pre-save hook will hash with bcrypt
    await admin.save();

    await AuditLog.create({
      action: 'RESET_PASSWORD',
      performedBy: 'superadmin',
      targetItem: admin.email,
      details: `Reset password for admin ${admin.username}`
    });

    res.json({ message: `Password for admin '${admin.username}' reset successfully!`, username: admin.username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Superadmin: Toggle Suspend Admin Account (Story 15)
exports.toggleSuspendAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = await User.findById(userId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    admin.isSuspended = !admin.isSuspended;
    await admin.save();

    await AuditLog.create({
      action: admin.isSuspended ? 'SUSPEND_ADMIN' : 'UNSUSPEND_ADMIN',
      performedBy: 'superadmin',
      targetItem: admin.email,
      details: `${admin.isSuspended ? 'Suspended' : 'Unsuspended'} admin account ${admin.username}`
    });

    res.json({
      message: `Admin '${admin.username}' has been ${admin.isSuspended ? 'suspended' : 'reactivated'}.`,
      isSuspended: admin.isSuspended
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Superadmin: Delete Admin Account (Story 15)
exports.deleteAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = await User.findByIdAndDelete(userId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    await AuditLog.create({
      action: 'DELETE_ADMIN',
      performedBy: 'superadmin',
      targetItem: admin.email,
      details: `Permanently deleted admin account ${admin.username} (${admin.email})`
    });

    res.json({ message: `Admin account '${admin.username}' deleted permanently.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Superadmin: Fetch Audit Logs (Story 15)
exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 8. Password Reset Request submission & resolution (Legacy support)
exports.requestPasswordRecovery = async (req, res) => {
  try {
    const { username, reason } = req.body;
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const resetRequest = await PasswordReset.create({ username: user.username, reason });
    res.status(201).json({ message: 'Recovery request submitted to Superadmin', requestId: resetRequest._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPasswordResetRequests = async (req, res) => {
  try {
    const requests = await PasswordReset.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.processPasswordReset = async (req, res) => {
  try {
    const { requestId, newPassword } = req.body;
    const resetReq = await PasswordReset.findById(requestId);
    if (!resetReq) return res.status(404).json({ error: 'Request not found' });
    const user = await User.findOne({ username: resetReq.username });
    if (user) {
      user.password = newPassword;
      await user.save();
    }
    resetReq.status = 'resolved';
    resetReq.newPasswordProvided = newPassword;
    resetReq.resolvedAt = new Date();
    await resetReq.save();
    res.json({ message: `Password reset successfully for ${user.username}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 9. Seed Default Superadmin Account
exports.seedSuperadmin = async () => {
  try {
    const superadmin = await User.findOne({ role: 'Superadmin' });
    if (!superadmin) {
      await User.create({
        firstName: 'Chief',
        lastName: 'Superadmin',
        fullName: 'Chief Superadmin',
        username: 'superadmin',
        email: 'superadmin@smartbin.local',
        password: 'admin123password',
        role: 'Superadmin',
        status: 'approved'
      });
      console.log('👑 Default Superadmin account created: superadmin / admin123password');
    }
  } catch (err) {
    console.error('Error seeding Superadmin:', err.message);
  }
};
