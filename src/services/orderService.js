const mongoose = require('mongoose');
const AssessmentOrder = require('../models/AssessmentOrder');

/**
 * Build a MongoDB filter object from query params.
 * This pushes filtering into the database instead of doing in-memory filtering.
 */
function buildOrderFilter(query) {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.userId) {
    // Validate ObjectId format without throwing
    if (mongoose.isValidObjectId(query.userId)) {
      filter.userId = new mongoose.Types.ObjectId(query.userId);
    } else {
      // Impossible to match anything if userId is invalid format
      filter.userId = { $exists: false };
    }
  }

  if (query.assessmentId) {
    if (mongoose.isValidObjectId(query.assessmentId)) {
      filter.assessmentId = new mongoose.Types.ObjectId(query.assessmentId);
    } else {
      filter.assessmentId = { $exists: false };
    }
  }

  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) {
      const from = new Date(query.fromDate);
      if (!Number.isNaN(from.getTime())) {
        filter.createdAt.$gte = from;
      }
    }
    if (query.toDate) {
      const to = new Date(query.toDate);
      if (!Number.isNaN(to.getTime())) {
        filter.createdAt.$lte = to;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) {
      delete filter.createdAt;
    }
  }

  // Simple text search across indexed fields
  if (query.q && query.q.trim()) {
    const search = query.q.trim();
    // Prefer text search when text index is present
    filter.$text = { $search: search };
  }

  return filter;
}

/**
 * Build a sort object from query params.
 * Only allow known fields to avoid unindexed sorts.
 */
function buildSort(query) {
  const allowedSortFields = new Set(['createdAt', 'updatedAt', 'price', 'completedAt']);

  const sortBy = query.sortBy && allowedSortFields.has(query.sortBy)
    ? query.sortBy
    : 'createdAt';
  const sortDir = query.sortDir === 'asc' ? 1 : -1;

  return { [sortBy]: sortDir };
}

/**
 * List orders with pagination and filters.
 * Returns { data, page, limit, total }.
 */
async function listOrders(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);
  const skip = (page - 1) * limit;

  const filter = buildOrderFilter(query);
  const sort = buildSort(query);

  // Minimal projection for list views. Avoid large metadata unless requested.
  const baseProjection = {
    userId: 1,
    assessmentId: 1,
    assessmentTitle: 1,
    userEmail: 1,
    status: 1,
    price: 1,
    currency: 1,
    createdAt: 1,
    updatedAt: 1,
    completedAt: 1,
  };

  const includeMetadata = query.includeMetadata === '1' || query.includeMetadata === true;
  if (includeMetadata) {
    baseProjection.metadata = 1;
  }

  // Run find + count in parallel to reduce latency.
  const [orders, total] = await Promise.all([
    AssessmentOrder.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select(baseProjection)
      .lean({ virtuals: true })
      .exec(),
    AssessmentOrder.countDocuments(filter).exec(),
  ]);

  return {
    data: orders,
    page,
    limit,
    total,
  };
}

/**
 * Get a single order by id.
 */
async function getOrderById(id) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  const projection = {
    userId: 1,
    assessmentId: 1,
    assessmentTitle: 1,
    userEmail: 1,
    status: 1,
    price: 1,
    currency: 1,
    metadata: 1,
    createdAt: 1,
    updatedAt: 1,
    completedAt: 1,
  };

  return AssessmentOrder.findById(id).select(projection).lean({ virtuals: true }).exec();
}

/**
 * Return quick aggregated stats for orders matching given filters.
 * Example: total count & revenue by status.
 */
async function summarizeOrders(query) {
  const filter = buildOrderFilter(query);

  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$price' },
      },
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1,
        totalRevenue: 1,
      },
    },
    {
      $sort: { status: 1 },
    },
  ];

  const results = await AssessmentOrder.aggregate(pipeline).exec();

  // Convert array of {status, count, totalRevenue} to an object keyed by status
  const summary = {};
  for (const row of results) {
    summary[row.status] = {
      count: row.count,
      totalRevenue: row.totalRevenue,
    };
  }

  return summary;
}

module.exports = {
  buildOrderFilter,
  buildSort,
  listOrders,
  getOrderById,
  summarizeOrders,
};
