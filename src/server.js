const env = require('./config/env');
const { connectDB, mongoose } = require('./config/db');
const app = require('./app');

async function start() {
  try {
    await connectDB();
  } catch (err) {
    console.error('✖ Could not connect to MongoDB:', err.message);
    console.error('  → Check MONGODB_URI in server/.env and (for Atlas) Network Access → allow your IP.');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`✔ API running on http://localhost:${env.PORT}/api  (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received — shutting down…`);
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

start();
