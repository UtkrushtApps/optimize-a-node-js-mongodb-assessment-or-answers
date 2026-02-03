# Solution Steps

1. Create a new Node.js project (or use the existing assessment skeleton) and ensure you have Express and Mongoose installed, along with dotenv for environment configuration.

2. Implement the MongoDB connection helper in src/config/db.js using Mongoose.connect, configuring reasonable pool sizes, timeouts, and strictQuery, and reuse the existing connection when already connected.

3. Define the AssessmentOrder Mongoose model in src/models/AssessmentOrder.js with fields such as userId, assessmentId, assessmentTitle, userEmail, status, price, currency, metadata, completedAt, and timestamps enabled for createdAt and updatedAt.

4. Add performance-oriented indexes to the AssessmentOrder schema: compound indexes on (status, createdAt) and (userId, status, createdAt), separate indexes on createdAt and completedAt, and a text index on assessmentTitle and userEmail to support efficient search.

5. In src/services/orderService.js, implement buildOrderFilter(query) to convert HTTP query parameters into a MongoDB filter object, validating ObjectIds, handling date ranges, and pushing q into a $text search instead of doing any in-memory filtering.

6. In the same service file, implement buildSort(query) so that only whitelisted fields (createdAt, updatedAt, price, completedAt) can be used for sorting, defaulting to createdAt, and mapping sortDir to ascending or descending properly.

7. Implement listOrders(query) in orderService so it parses page and limit, builds the filter and sort, and issues a single Mongoose find query with .sort(), .skip(), .limit(), .select() (minimal fields, optionally including metadata), and .lean(), while in parallel calling countDocuments(filter) via Promise.all to return { data, page, limit, total }.

8. Implement getOrderById(id) in orderService to validate the id, then call AssessmentOrder.findById with a projection for all needed fields, using .lean() for performance, and return null if the id is invalid or no document is found.

9. Implement summarizeOrders(query) with an aggregation pipeline: $match using the same filter as listOrders, then $group by status to compute count and totalRevenue, $project into a clean shape, $sort by status, and finally convert the array of results into an object keyed by status.

10. Create the Express routes in src/routes/orders.js: a GET /orders endpoint that calls orderService.listOrders and returns the paginated result; a GET /orders/summary endpoint that calls summarizeOrders; and a GET /orders/:id endpoint that calls getOrderById and returns 404 if the order is not found.

11. Add centralized error-handling middleware in src/middleware/errorHandler.js: a notFoundHandler that returns a 404 JSON response for unknown routes, and an errorHandler that logs a concise error and responds with a sanitized message and status code (without leaking stack traces in production).

12. Implement the background worker in src/worker/orderProcessor.js with configuration for interval and batch size: expose startOrderProcessor() and stopOrderProcessor(), and keep an isProcessing flag plus an intervalHandle to avoid overlapping runs and support graceful shutdown.

13. Within the worker, implement processPendingOrdersBatch(batchSize) as a loop that repeatedly finds the oldest PENDING orders via find({status:'PENDING'}).sort({createdAt:1}).limit(batchSize).select({_id:1}).lean(), breaks when none are found, and otherwise performs a single updateMany on all fetched ids to set status to COMPLETED and update completedAt/updatedAt timestamps, thus avoiding N+1 updates and large in-memory documents.

14. Implement tick() in the worker to guard against concurrent execution using isProcessing, call processPendingOrdersBatch with the configured batch size, and catch/log any errors without throwing them outside the worker loop.

15. Implement startOrderProcessor() to run tick() immediately once, then schedule tick at a fixed interval using setInterval with .unref(), logging configuration details; implement stopOrderProcessor() to clear the interval and wait briefly for any in-flight processing to complete before returning.

16. Create server.js as the application entry point: load environment variables with dotenv, connect to MongoDB via connectDb(), create an Express app, register JSON parsing, mount the /orders router, and attach the notFoundHandler and errorHandler middleware.

17. In server.js, start the HTTP server on a configurable PORT, invoke startOrderProcessor() after the server and DB are ready, and implement signal handlers for SIGINT and SIGTERM that call stopOrderProcessor(), close the HTTP server, and then exit the process gracefully (with a failsafe timeout).

18. Run npm install for required dependencies (express, mongoose, dotenv) if not already present, start MongoDB, and run the application; verify that listing, searching, and summary endpoints return correct data and that PENDING orders are periodically transitioned to COMPLETED without CPU spikes or unbounded memory growth.

