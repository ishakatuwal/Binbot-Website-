/**
 * backend/controllers/staffController.js
 * Staff Management with 10-digit phone validation, duplicate prevention, and deletion handler.
 */

const Staff = require('../models/Staff');
const AuditLog = require('../models/AuditLog');

// Register Collection Staff Member (Story 18)
exports.registerStaff = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ error: 'First name, last name, and phone number are required.' });
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    // Extract numbers only
    const digitsOnly = phone.toString().replace(/\D/g, '');

    // 10-Digit Validation
    if (digitsOnly.length !== 10) {
      return res.status(400).json({ 
        error: 'Invalid Phone Number: Must be exactly 10 digits (e.g. 0414972400)' 
      });
    }

    // Check Duplicate Phone Number
    const existingStaff = await Staff.findOne({ phone: digitsOnly });
    if (existingStaff) {
      return res.status(400).json({ 
        error: `Duplicate Phone Number: Staff member (${existingStaff.fullName}) is already registered with number ${digitsOnly}.` 
      });
    }

    const newStaff = await Staff.create({
      firstName: cleanFirstName,
      lastName: cleanLastName,
      phone: digitsOnly,
      status: 'AVAILABLE'
    });

    await AuditLog.create({
      action: 'REGISTER_STAFF',
      performedBy: 'operator',
      targetItem: digitsOnly,
      details: `Registered staff member ${newStaff.fullName} (${digitsOnly}).`
    });

    res.status(201).json({
      message: `Staff member ${newStaff.fullName} registered successfully!`,
      staff: newStaff
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Duplicate Phone Number: A staff member with this number already exists.' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get All Registered Staff
exports.getStaff = async (req, res) => {
  try {
    const staffMembers = await Staff.find().sort({ createdAt: -1 });
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Staff Member
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Staff.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    await AuditLog.create({
      action: 'DELETE_STAFF',
      performedBy: 'operator',
      targetItem: deleted.phone,
      details: `Removed collection staff member ${deleted.fullName} (${deleted.phone}).`
    });

    res.json({ message: `Staff member ${deleted.fullName} removed successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
