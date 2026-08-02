const User = require('../../backend/models/User');
const AuditLog = require('../../backend/models/AuditLog');
const bcrypt = require('bcryptjs');

exports.registerAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email address already registered' });
    }
    const username = cleanEmail.split('@')[0];
    const newAdmin = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      username,
      email: cleanEmail,
      password,
      role: 'Admin',
      status: 'approved'
    });
    await AuditLog.create({
      action: 'CREATE_ADMIN',
      performedBy: 'superadmin',
      targetItem: cleanEmail,
      details: `Created admin profile: ${newAdmin.fullName} (${cleanEmail})`
    });
    res.status(201).json({ message: 'Profile Successfully Created', user: newAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Credentials Invalid' });
    }
    const cleanUser = username.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ username: cleanUser }, { email: cleanUser }]
    });
    if (!user) {
      return res.status(400).json({ error: 'Credentials Invalid' });
    }
    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account Suspended. Contact Superadmin.' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Credentials Invalid' });
    }
    const sessionExpiresAt = Date.now() + 30 * 60 * 1000;
    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        fullName: user.fullName || user.username,
        username: user.username,
        email: user.email,
        role: user.role,
        sessionExpiresAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Credentials Invalid' });
  }
};

exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'Admin' }).select('-password').sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetAdminPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = newPassword;
    await user.save();
    await AuditLog.create({
      action: 'RESET_PASSWORD',
      performedBy: 'superadmin',
      targetItem: user.email,
      details: `Reset password for admin: ${user.email}`
    });
    res.json({ message: `Password reset successfully for ${user.email}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleSuspendAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isSuspended = !user.isSuspended;
    await user.save();
    await AuditLog.create({
      action: user.isSuspended ? 'SUSPEND_ADMIN' : 'REACTIVATE_ADMIN',
      performedBy: 'superadmin',
      targetItem: user.email,
      details: `${user.isSuspended ? 'Suspended' : 'Reactivated'} admin account: ${user.email}`
    });
    res.json({ message: `Admin account ${user.isSuspended ? 'suspended' : 'reactivated'}.`, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await AuditLog.create({
      action: 'DELETE_ADMIN',
      performedBy: 'superadmin',
      targetItem: user.email,
      details: `Permanently deleted admin account: ${user.email}`
    });
    res.json({ message: `Admin account '${user.email}' deleted permanently.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.seedSuperadmin = async () => {
  try {
    const count = await User.countDocuments({ role: 'Superadmin' });
    if (count === 0) {
      await User.create({
        firstName: 'System',
        lastName: 'Superadmin',
        fullName: 'System Superadmin',
        username: 'superadmin',
        email: 'superadmin@smartbin.gov',
        password: 'admin123password',
        role: 'Superadmin',
        status: 'approved'
      });
      console.log('👑 Default Superadmin seeded: superadmin / admin123password');
    }
  } catch (err) {
    console.error('Superadmin seed error:', err.message);
  }
};
