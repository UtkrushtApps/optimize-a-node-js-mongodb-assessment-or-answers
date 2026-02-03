const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Assessment order schema
 * Represents an order placed by a user to purchase / take an assessment.
 */
const AssessmentOrderSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    assessmentTitle: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: 'USD',
      uppercase: true,
      maxlength: 3,
    },
    // Arbitrary metadata about the order / assessment
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // When processing completed
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
  }
);

/**
 * Indexing strategy tuned to common access patterns:
 * - list PENDING orders ordered by createdAt for background worker
 * - list/search orders by user and status for API
 * - search by text on assessmentTitle and userEmail
 */
AssessmentOrderSchema.index({ status: 1, createdAt: 1 });
AssessmentOrderSchema.index({ userId: 1, status: 1, createdAt: -1 });
AssessmentOrderSchema.index({ createdAt: -1 });
AssessmentOrderSchema.index({ completedAt: 1 });

// Text index for simple search across key fields
AssessmentOrderSchema.index({ assessmentTitle: 'text', userEmail: 'text' });

// Helpful lean transformation: remove __v by default
AssessmentOrderSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret) => {
    return ret;
  },
});

const AssessmentOrder = mongoose.model('AssessmentOrder', AssessmentOrderSchema);

module.exports = AssessmentOrder;
