require('dotenv').config();
const express = require('express');
const http = require('http');

const connectDb = require('./src/config/db');
const ordersRouter = require('./src/routes/orders');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorHandler');
const { startOrderProcessor, stopOrderProcessor } = require('./src/worker/orderProcessor');

/**
 * Application bootstrap
 */
async function bootstrap() {
  await connectDb();

  const app = express();

  // Core middleware
  app.use(express.json({ limit: '1mb' }));

  // Routes
  app.use('/orders', ordersRouter);

  // 404 + error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  const port = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Start background worker after DB and HTTP server are up
  startOrderProcessor();

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await stopOrderProcessor();
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });

      // Failsafe shutdown
      setTimeout(() => {
        console.error('Forcing shutdown');
        process.exit(1);
      }, 10000).unref();
    } catch (err) {
      console.error('Error during shutdown', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start application', err);
  process.exit(1);
});
