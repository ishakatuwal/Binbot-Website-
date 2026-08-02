const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ishakatuwal2061_db_user:gV57X3FmlG75kTX7@cluster0.oa99ti5.mongodb.net/waste_management?retryWrites=true&w=majority&appName=Cluster0');
    console.log(`✅ MongoDB Connected Successfully: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
