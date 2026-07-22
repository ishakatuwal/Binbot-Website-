const express = require('express');
const router = express.Router();
const { registerBin, getAllBins, updateBinFromESP32 } = require('../controllers/binController');

router.post('/register', registerBin);
router.get('/', getAllBins);
router.post('/esp32-update', updateBinFromESP32);

module.exports = router;
