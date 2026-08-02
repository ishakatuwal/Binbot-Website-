/**
 * backend/models/AuditLog.js
 * Tracks all administrative creation, update, suspension, and deletion actions with timestamps.
 */

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true
    },
    performedBy: {
      type: String,
      required: true,
      default: 'superadmin'
    },
    targetItem: {
      type: String,
      required: true
    },
    details: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
