const mongoose = require('mongoose');
const env = require('./env');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
mongoose.set('strictQuery', true);

async function connectDB() {
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const { host, name } = mongoose.connection;
  console.log(`✔ MongoDB connected → ${host}/${name}`);
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
}

module.exports = { connectDB, mongoose };
