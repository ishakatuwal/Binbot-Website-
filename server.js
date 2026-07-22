const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const socketModule = require('./socket');
const authRoutes = require('./routes/authRoutes');
const binRoutes = require('./routes/binRoutes');
const { seedSuperadmin } = require('./controllers/authController');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

connectDB().then(() => seedSuperadmin());

const server = http.createServer(app);
socketModule.init(server);

app.use('/api/auth', authRoutes);
app.use('/api/bins', binRoutes);

app.get('/', (req, res) => {
  res.send('♻️ Smart Waste Management Backend & Socket.io Alert System Online!');
});

server.listen(PORT, () => {
  console.log(`🚀 Smart Waste Management Backend Running on Port ${PORT}`);
});
