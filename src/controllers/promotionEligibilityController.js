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
  const calculateWeeksMetRequirement = async (userId, pledgedHours) => {
    const weeklyTasks = await TimeEntry.aggregate([
      { $match: { personId: mongoose.Types.ObjectId(userId), isTangible: true } },
      { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'taskInfo' } },
      { $unwind: '$taskInfo' },
      { $match: { 'taskInfo.taskName': { $regex: /review|pr/i } } },
      {
        $group: {
          _id: { $week: { $toDate: '$dateOfWork' } },
          totalHours: { $sum: { $divide: ['$totalSeconds', 3600] } },
        },
      },
      { $match: { totalHours: { $gte: pledgedHours / 2 } } },
    ]);
    return weeklyTasks.length;
  };

  const getPromotionEligibilityData = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'getReports'))) {
      return res.status(403).send('You are not authorized to view promotion eligibility data.');
    }

    try {
      const users = await UserProfile.find(
        { isActive: true },
        '_id firstName lastName weeklycommittedHours createdDate',
      );

      // Refactor: Use map and Promise.all for concurrent processing
      const eligibilityPromises = users.map(async (user) => {
        const pledgedHours = user.weeklycommittedHours || 0;
        const requiredPRs = pledgedHours / 2;

        const totalReviews = await Task.countDocuments({
          resources: { $elemMatch: { userID: user._id, completedTask: true } },
          taskName: { $regex: /review|pr/i },
        });

        const successfulWeeks = await calculateWeeksMetRequirement(user._id, pledgedHours);

        const remainingWeeks = Math.max(0, 2 - successfulWeeks);
        const isNewMember =
          (new Date() - new Date(user.createdDate)) / (1000 * 60 * 60 * 24 * 30.44) < 6;
        const weeklyRequirementsMet = successfulWeeks >= 2;

        const dataEntry = {
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

        // Save/update the calculated data in the new collection concurrently
        // This will still have await, but it's within a map callback, not a sequential loop that blocks subsequent iterations.
        await PromotionEligibility.findOneAndUpdate({ reviewerId: user._id }, dataEntry, {
          upsert: true,
          new: true,
        });

        return dataEntry; // Return the data entry to be collected by Promise.all
      });

      const eligibilityData = await Promise.all(eligibilityPromises); // Await all promises to resolve

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
