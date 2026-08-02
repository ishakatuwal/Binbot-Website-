const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const socketModule = require('./socket');
const authRoutes = require('./routes/authRoutes');
const binRoutes = require('./routes/binRoutes');
const staffRoutes = require('./routes/staffRoutes');
const taskRoutes = require('./routes/taskRoutes');
const reportRoutes = require('./routes/reportRoutes');

const { seedSuperadmin } = require('./controllers/authController');
const { getAlerts, updateBinFromESP32 } = require('./controllers/binController');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files from ./public or ../public
const publicPath = require('fs').existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../public');

app.use(express.static(publicPath));

connectDB().then(() => seedSuperadmin());

const server = http.createServer(app);
socketModule.init(server);

// API Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/bins', binRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/alerts', getAlerts);
app.post('/api/telemetry', updateBinFromESP32);

app.get('/api-status', (req, res) => {
  res.send('♻️ Smart Waste Management Backend & Socket.io Alert System Online!');
});

app.get('/download-viva-guide', (req, res) => {
  const guidePath = path.join(__dirname, '../viva_presentation_guide.md');
  if (require('fs').existsSync(guidePath)) {
    res.download(guidePath, 'viva_presentation_guide.md');
  } else {
    res.status(404).send('Viva guide file not found');
  }
});

// Fallback to index.html for root path / SPA frontend
app.get('*', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('♻️ Smart Waste Management Backend & Socket.io Alert System Online!');
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Smart Waste Management Server Running on Port ${PORT}`);
  console.log(`🔗 Open Frontend Website: http://localhost:${PORT}`);
});
