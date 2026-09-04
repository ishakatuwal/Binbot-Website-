/**
 * backend/models/Task.js
 * Task Schema linking Staff to specific Bins and compartments for collection assignments.
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    staffName: {
      type: String,
      required: true
    },
    staffPhone: {
      type: String,
      required: true
    },
    binId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    location: {
      type: String,
      required: true
    },
    compartment: {
      type: String,
      enum: ['dry', 'wet', 'metal'],
      required: true
    },
    status: {
      type: String,
      enum: ['ASSIGNED', 'COMPLETED'],
      default: 'ASSIGNED'
    },
    smsStatus: {
      type: String,
      enum: ['SENT', 'FAILED', 'SIMULATED', 'ASSIGNED', 'MOCK_DISPATCH'],
      default: 'SENT'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Task', taskSchema);
