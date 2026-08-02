const mongoose = require('mongoose');

const binSchema = new mongoose.Schema(
  {
    binId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    location: { type: String, required: true, trim: true },
    latitude: { type: Number, default: -33.8688 },
    longitude: { type: Number, default: 151.2093 },
    compartments: {
      dry: { type: Number, min: 0, max: 100, default: 0 },
      wet: { type: Number, min: 0, max: 100, default: 0 },
      metal: { type: Number, min: 0, max: 100, default: 0 }
    },
    lastUpdated: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bin', binSchema);
