const express = require('express');
const router = express.Router();
const {
  registerBin,
  getAllBins,
  updateBinFromESP32,
  getAlerts,
  acknowledgeAlert,
  emptyBin,
  deleteBin
} = require('../controllers/binController');

router.post('/register', registerBin);
router.get('/', getAllBins);
router.post('/esp32-update', updateBinFromESP32);
router.post('/telemetry', updateBinFromESP32); // ESP32 simulator route alias

// Alerts & Operator Actions
router.get('/alerts', getAlerts);
router.post('/alerts/:alertId/acknowledge', acknowledgeAlert);
router.post('/:binId/empty', emptyBin);
router.delete('/:binId', deleteBin);

module.exports = router;
