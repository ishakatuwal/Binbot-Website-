/**
 * database/models/PasswordReset.js
 * Tracks password recovery requests.
 */

const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    reason: {
      type: String,
      default: 'Password reset requested by Admin'
    },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending'
    },
    newPasswordProvided: {
      type: String
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
