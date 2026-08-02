const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    staffName: { type: String, required: true },
    staffPhone: { type: String, required: true },
    binId: { type: String, required: true, trim: true, uppercase: true },
    location: { type: String, required: true },
    compartment: { type: String, enum: ['dry', 'wet', 'metal'], required: true },
    status: { type: String, enum: ['ASSIGNED', 'COMPLETED'], default: 'ASSIGNED' },
    smsStatus: { type: String, enum: ['SENT', 'FAILED', 'MOCK_DISPATCH'], default: 'MOCK_DISPATCH' },
    assignedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
