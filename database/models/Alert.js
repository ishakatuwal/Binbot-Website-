const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    binId: { type: String, required: true, trim: true, uppercase: true },
    location: { type: String, required: true },
    compartment: { type: String, enum: ['dry', 'wet', 'metal'], required: true },
    fillLevel: { type: Number, required: true },
    threshold: { type: String, default: '80%' },
    status: { type: String, enum: ['UNRESOLVED', 'ACKNOWLEDGED', 'RESOLVED', 'ASSIGNED'], default: 'UNRESOLVED' },
    acknowledgedBy: { type: String, default: null },
    isAssigned: { type: Boolean, default: false },
    assignedStaffName: { type: String, default: null },
    assignedStaffPhone: { type: String, default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    message: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
