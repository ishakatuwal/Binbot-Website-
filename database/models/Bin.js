/**
 * database/models/Bin.js
 * Bin Schema tracking location and dry, wet, metal fill levels as percentages.
 */

const mongoose = require('mongoose');

const binSchema = new mongoose.Schema(
  {
    binId: {
      type: String,
      required: [true, 'Bin ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    location: {
      type: String,
      required: [true, 'Bin location is required'],
      trim: true
    },
    compartments: {
      dry: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      wet: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      metal: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Bin', binSchema);
