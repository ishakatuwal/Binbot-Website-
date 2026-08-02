const express = require('express');
const router = express.Router();
const { generatePdfReport } = require('../controllers/reportController');

router.get('/pdf', generatePdfReport);

module.exports = router;
