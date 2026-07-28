/**
 * backend/controllers/authController.js
 * Handles Auth, Admin registration, Superadmin approval workflows, and Password recovery.
 */

const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');

// 1. Admin Registration (Starts in pending_approval status)
exports.registerAdmin = async (req, res) => {
  try {
    const { username, email, password, name, fullName } = req.body;
    const adminFullName = name || fullName || username;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const existingUser = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists in system' });
    }

    const newAdmin = await User.create({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      fullName: adminFullName,
      role: 'Admin',
      status: 'pending_approval'
    });

    res.status(201).json({
      message: 'Registration submitted successfully! Your account is now pending Superadmin approval.',
      user: newAdmin
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. User Login (Verifies Admin approval status)
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fields required' });

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Enforce Superadmin approval check for Admin accounts
    if (user.role === 'Admin') {
      if (user.status === 'pending_approval') {
        return res.status(403).json({
          error: 'Your account is pending Superadmin approval. Please contact Superadmin to activate access.',
          status: 'pending_approval'
        });
      }
      if (user.status === 'rejected') {
        return res.status(403).json({
          error: 'Account access has been rejected by Superadmin.',
          status: 'rejected'
        });
      }
    }

    res.json({ message: 'Login successful', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Superadmin: Fetch All Admins (Pending & Approved)
exports.getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'Admin' }).sort({ createdAt: -1 });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Superadmin: Approve Admin Profile
exports.approveAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = await User.findById(userId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    admin.status = 'approved';
    await admin.save();

    res.json({ message: `Admin '${admin.username}' approved successfully!`, admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Superadmin: Reject Admin Profile
exports.rejectAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const admin = await User.findById(userId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found' });
    }

    admin.status = 'rejected';
    await admin.save();

    res.json({ message: `Admin '${admin.username}' access rejected.`, admin });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Admin Password Recovery Request
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

// 7. Get Password Reset Requests
exports.getPasswordResetRequests = async (req, res) => {
  try {
    const requests = await PasswordReset.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 8. Superadmin Processes Password Reset
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
        username: 'superadmin',
        email: 'superadmin@smartbin.local',
        password: 'admin123password',
        role: 'Superadmin',
        status: 'approved',
        fullName: 'Chief Superadmin'
      });
      console.log('👑 Default Superadmin created: superadmin / admin123password');
    }
  } catch (err) {
    console.error('Error seeding Superadmin:', err.message);
  }
};
