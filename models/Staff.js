/**
 * backend/models/Staff.js
 * Staff Schema for waste collection operators with unique phone validation (Story 18).
 */

const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true
    },
    fullName: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true
    },
    role: {
      type: String,
      default: 'Staff'
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'OFF_DUTY'],
      default: 'AVAILABLE'
    }
  },
  {
    timestamps: true
  }
);

staffSchema.pre('save', function (next) {
  if (this.firstName || this.lastName) {
    this.fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  }
  next();
});

module.exports = mongoose.model('Staff', staffSchema);
