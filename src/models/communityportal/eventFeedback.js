const mongoose = require('mongoose');

const { Schema } = mongoose;

const eventFeedbackSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.'],
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comments: { type: String, trim: true },
    /**
     * NOTE: Fields `createdBy` is currently stored as String.
     *
     * TODO: When User model is available:
     *  - Change types to `mongoose.Schema.Types.ObjectId`
     *  - Add `ref: 'User'`
     *  - Update controller to validate ObjectIds before saving
     *  - Run a migration script to convert existing String IDs to ObjectIds
     *
     */

    createdBy: {
      type: String,
      required: true,
    },
    /**
     * NOTE: Fields `eventId`, `attendanceId` are currently stored as Number.
     *
     * TODO: When Event and Attendance models are available:
     *  - Change types to `mongoose.Schema.Types.ObjectId`
     *  - Add `ref: 'Event'` and `ref: 'Attendance'`
     *  - Update controller to validate ObjectIds before saving
     *  - Run a migration script to convert existing Number IDs to ObjectIds
     *
     */
    eventId: {
      type: Number,
      required: true,
    },
    attendanceId: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('EventFeedback', eventFeedbackSchema, 'eventfeedbacks');
