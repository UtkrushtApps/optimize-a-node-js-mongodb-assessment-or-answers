const AssessmentOrder = require('../models/AssessmentOrder');

let intervalHandle = null;
let isProcessing = false;

// Configurable defaults; can be overridden via env vars.
const DEFAULT_INTERVAL_MS = Number(process.env.ORDER_PROCESSOR_INTERVAL_MS) || 5000;
const DEFAULT_BATCH_SIZE = Number(process.env.ORDER_PROCESSOR_BATCH_SIZE) || 100;

/**
 * Process pending orders in small batches, updating them to COMPLETED.
 *
 * Key optimizations:
 * - Work in bounded batches (limit) to keep memory and lock time low.
 * - Only select _id when identifying documents to update.
 * - Use updateMany to avoid N+1 round-trips.
 * - Guard with isProcessing to avoid overlapping runs if an iteration is slow.
 */
async function processPendingOrdersBatch(batchSize) {
  while (true) {
    // Fetch only identifiers of the oldest pending orders.
    const pendingIds = await AssessmentOrder.find({ status: 'PENDING' })
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .select({ _id: 1 })
      .lean()
      .exec();

    if (!pendingIds.length) {
      // Nothing left to process.
      break;
    }

    const ids = pendingIds.map((doc) => doc._id);
    const now = new Date();

    // Atomically update all fetched PENDING orders.
    await AssessmentOrder.updateMany(
      { _id: { $in: ids }, status: 'PENDING' },
      {
        $set: {
          status: 'COMPLETED',
          completedAt: now,
          updatedAt: now,
        },
      }
    ).exec();

    // Loop continues until we hit a batch with no results.
  }
}

async function tick() {
  if (isProcessing) {
    // Skip this tick if previous run is still in progress; prevents buildup.
    return;
  }

  isProcessing = true;
  try {
    await processPendingOrdersBatch(DEFAULT_BATCH_SIZE);
  } catch (err) {
    console.error('Error processing pending orders:', err);
  } finally {
    isProcessing = false;
  }
}

function startOrderProcessor() {
  if (intervalHandle) {
    return; // already running
  }

  // Kick off immediately, then run at fixed interval.
  tick().catch((err) => {
    console.error('Initial order processing tick failed:', err);
  });

  intervalHandle = setInterval(() => {
    tick().catch((err) => {
      console.error('Order processing tick failed:', err);
    });
  }, DEFAULT_INTERVAL_MS);

  // Do not keep Node.js process alive just because of the worker timer
  intervalHandle.unref();

  console.log(
    `Order processor started (interval=${DEFAULT_INTERVAL_MS}ms, batchSize=${DEFAULT_BATCH_SIZE})`
  );
}

async function stopOrderProcessor() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  // Wait until any in-flight processing completes
  const waitStart = Date.now();
  while (isProcessing && Date.now() - waitStart < 10000) {
    // backoff sleep 100ms
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (isProcessing) {
    console.warn('Order processor still busy during shutdown; exiting anyway');
  } else {
    console.log('Order processor stopped');
  }
}

module.exports = {
  startOrderProcessor,
  stopOrderProcessor,
  // Exported for potential tests
  processPendingOrdersBatch,
};
