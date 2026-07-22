/**
 * backend/controllers/authController.js
 * Handles Auth, Admin registration, and Password recovery logic.
 */

const User = require('../../database/models/User');
const PasswordReset = require('../../database/models/PasswordReset');

exports.registerAdmin = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    const newAdmin = await User.create({ username, email, password, fullName, role: 'Admin' });
    res.status(201).json({ message: 'New Admin created successfully', user: newAdmin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fields required' });
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json({ message: 'Login successful', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

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

exports.seedSuperadmin = async () => {
  try {
    const superadmin = await User.findOne({ role: 'Superadmin' });
    if (!superadmin) {
      await User.create({
        username: 'superadmin',
        email: 'superadmin@smartbin.local',
        password: 'admin123password',
        role: 'Superadmin',
        fullName: 'Chief Superadmin'
      });
      console.log('👑 Default Superadmin created: superadmin / admin123password');
    }
  } catch (err) {
    console.error('Error seeding Superadmin:', err.message);
  }
};
