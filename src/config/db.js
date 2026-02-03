const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose with sensible production defaults.
 * The connection is reused by all models.
 */
async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/assessment-orders';

  // Avoid re-connecting if already connected (important in tests / workers)
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 20,
    minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE) || 0,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    autoIndex: process.env.NODE_ENV !== 'production',
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });

  return mongoose.connection;
}

module.exports = connectDb;
