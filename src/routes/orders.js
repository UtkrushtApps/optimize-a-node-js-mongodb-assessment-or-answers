const express = require('express');
const router = express.Router();

const orderService = require('../services/orderService');

/**
 * GET /orders
 * List orders with filters, pagination, and sorting.
 * Query params:
 * - page, limit
 * - status
 * - userId
 * - assessmentId
 * - fromDate, toDate (ISO date strings)
 * - q (full-text search on assessmentTitle / userEmail)
 * - sortBy (createdAt|updatedAt|price|completedAt)
 * - sortDir (asc|desc)
 * - includeMetadata=1 to include metadata field in results
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await orderService.listOrders(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /orders/summary
 * Aggregate stats for orders matching filters.
 */
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await orderService.summarizeOrders(req.query);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /orders/:id
 * Fetch a single order by id.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
