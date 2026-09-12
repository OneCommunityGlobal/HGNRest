// src/controllers/promotionEligibilityController.js
const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const { ValidationError } = require('../utilities/errorHandling/customError');

const promotionEligibilityController = function (
  UserProfile,
  TimeEntry,
  Task,
  PromotionEligibility,
) {
  // Batched across all users: one aggregate returns, per user, the list of weekly
  // hour totals for review/PR-tagged tangible time entries. The per-user pledged-hours
  // threshold varies, so filtering weeks against it happens in JS after this query returns.
  const getWeeklyHoursByUser = async (userIds) => {
    const rows = await TimeEntry.aggregate([
      { $match: { personId: { $in: userIds }, isTangible: true } },
      { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'taskInfo' } },
      { $unwind: '$taskInfo' },
      { $match: { 'taskInfo.taskName': { $regex: /review|pr/i } } },
      {
        $group: {
          _id: { personId: '$personId', week: { $week: { $toDate: '$dateOfWork' } } },
          totalHours: { $sum: { $divide: ['$totalSeconds', 3600] } },
        },
      },
    ]);

    const weeklyHoursByUser = new Map();
    rows.forEach(({ _id, totalHours }) => {
      const key = _id.personId.toString();
      if (!weeklyHoursByUser.has(key)) weeklyHoursByUser.set(key, []);
      weeklyHoursByUser.get(key).push(totalHours);
    });
    return weeklyHoursByUser;
  };

  // Batched across all users: counts, per user, the number of distinct review/PR-tagged
  // tasks where that user appears in `resources` with completedTask true — matching the
  // semantics of the original per-user Task.countDocuments call exactly.
  const getReviewCountsByUser = async (userIds) => {
    const rows = await Task.aggregate([
      {
        $match: {
          taskName: { $regex: /review|pr/i },
          resources: { $elemMatch: { userID: { $in: userIds }, completedTask: true } },
        },
      },
      { $unwind: '$resources' },
      {
        $match: {
          'resources.userID': { $in: userIds },
          'resources.completedTask': true,
        },
      },
      // Dedupe so a task counts at most once per user, matching countDocuments semantics.
      { $group: { _id: { userID: '$resources.userID', taskId: '$_id' } } },
      { $group: { _id: '$_id.userID', totalReviews: { $sum: 1 } } },
    ]);

    return new Map(rows.map(({ _id, totalReviews }) => [_id.toString(), totalReviews]));
  };

  const getPromotionEligibilityData = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'getReports'))) {
      return res.status(403).send('You are not authorized to view promotion eligibility data.');
    }

    try {
      const users = await UserProfile.find(
        {
          isActive: true,
          role: { $nin: ['Owner', 'Administrator', 'Promoted Reviewer'] },
        },
        '_id firstName lastName weeklycommittedHours createdDate',
      ).lean();

      const userIds = users.map((user) => user._id);

      const [weeklyHoursByUser, reviewCountsByUser] = await Promise.all([
        getWeeklyHoursByUser(userIds),
        getReviewCountsByUser(userIds),
      ]);

      const eligibilityData = users.map((user) => {
        const pledgedHours = user.weeklycommittedHours || 0;
        const requiredPRs = pledgedHours / 2;

        const totalReviews = reviewCountsByUser.get(user._id.toString()) || 0;

        const weeklyHours = weeklyHoursByUser.get(user._id.toString()) || [];
        const successfulWeeks = weeklyHours.filter((hours) => hours >= pledgedHours / 2).length;

        const remainingWeeks = Math.max(0, 2 - successfulWeeks);
        const isNewMember =
          (new Date() - new Date(user.createdDate)) / (1000 * 60 * 60 * 24 * 30.44) < 6;
        const weeklyRequirementsMet = successfulWeeks >= 2;

        return {
          reviewerId: user._id,
          reviewerName: `${user.firstName} ${user.lastName}`,
          pledgedHours,
          requiredPRs,
          totalReviews,
          remainingWeeks,
          isNewMember,
          weeklyRequirementsMet,
          calculatedAt: new Date(),
        };
      });

      // Persist the computed snapshot for promoteMembers to read/update later. The response
      // below already reflects the freshly computed data, so this write does not need to
      // block the request — it just needs to happen.
      if (eligibilityData.length > 0) {
        PromotionEligibility.bulkWrite(
          eligibilityData.map((dataEntry) => ({
            updateOne: {
              filter: { reviewerId: dataEntry.reviewerId },
              update: { $set: dataEntry },
              upsert: true,
            },
          })),
        ).catch((error) => {
          logger.logException(error, { endpoint: 'getPromotionEligibilityData:bulkWrite' });
        });
      }

      res.status(200).json(eligibilityData);
    } catch (error) {
      logger.logException(error, { endpoint: 'getPromotionEligibilityData' });
      res.status(500).send('Error fetching promotion eligibility data.');
    }
  };

  const promoteMembers = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'putUserProfile'))) {
      return res.status(403).send('You are not authorized to promote members.');
    }

    const { memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).send('No member IDs provided for promotion.');
    }

    let session = null;

    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const promotedMembers = [];
      // Refactor: Use reduce for sequential processing of members within a transaction
      // This is necessary because transaction operations need to happen sequentially on the same session.
      await memberIds.reduce(async (previousPromise, memberId) => {
        await previousPromise; // Ensure the previous member's operations are complete

        if (!mongoose.Types.ObjectId.isValid(memberId)) {
          throw new ValidationError(`Invalid member ID: ${memberId}`);
        }
        const user = await UserProfile.findById(memberId).session(session);
        if (user) {
          user.role = 'Promoted Reviewer';
          await user.save({ session });
          promotedMembers.push({ id: memberId, name: `${user.firstName} ${user.lastName}` });

          await PromotionEligibility.findOneAndUpdate(
            { reviewerId: memberId },
            { $set: { isPromoted: true, promotionDate: new Date() } },
            { new: true, session },
          );
        } else {
          logger.logInfo(`Attempted to promote non-existent user with ID: ${memberId}`);
        }
      }, Promise.resolve()); // Initial resolved promise to start the chain

      await session.commitTransaction();
      session.endSession();

      logger.logInfo(`Promoted members: ${JSON.stringify(promotedMembers)}`, {
        action: 'promoteMembers',
        promotedBy: req.body.requestor.requestorId,
      });
      res.status(200).send({ message: 'Members promoted successfully.', promotedMembers });
    } catch (error) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      logger.logException(error, { endpoint: 'promoteMembers', payload: req.body });
      if (error instanceof ValidationError) {
        return res.status(400).send({ error: error.message });
      }
      res.status(500).send('Error promoting members.');
    }
  };

  return { getPromotionEligibilityData, promoteMembers };
};

module.exports = promotionEligibilityController;
