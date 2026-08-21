// src/controllers/promotionEligibilityController.js
const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const cache = require('../utilities/nodeCache')();
const { ValidationError } = require('../utilities/errorHandling/customError');
const {
  resolvePrsNeeded,
  summariseWeeks,
  mongoWeekOf,
} = require('../helpers/promotionEligibilityHelper');
const { DEFAULT_REVIEWER_GROUPS, isReviewerInGroup } = require('../helpers/reviewerGroupHelper');
const { placeReviewer, isPlaceableTeam } = require('../helpers/teamPlacementHelper');

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const PROMOTED_ROLE = 'Promoted Reviewer';

/**
 * `Team` and `HgnFormResponses` are optional and only used by the promotion
 * placement handlers. Leaving them off keeps every existing caller, and the
 * existing tests, working exactly as before.
 */
const promotionEligibilityController = function (
  UserProfile,
  TimeEntry,
  Task,
  PromotionEligibility,
  ReviewerGroup,
  Team,
  HgnFormResponses,
) {
  /**
   * How many PRs a reviewer reviewed in each week they logged review work.
   *
   * The spec counts weeks where the reviewer "met or exceeded PR requirement",
   * so this has to be a count of reviews, not the hours the old version summed.
   * Actual PR review records exist (`pullRequestReview`) but store GitHub's
   * numeric account id, which cannot be joined to an HGN profile yet, so the
   * count stays on the same review-task proxy the rest of this page uses: one
   * review task worked on in a week counts as one PR reviewed that week.
   * `$addToSet` rather than a plain count, so several time entries against the
   * same task in one week are still one review.
   *
   * Grouped by year as well as week. `$week` alone repeats every year, which
   * would have folded the same week number from different years together.
   *
   * @returns {Promise<Array<{year: number, week: number, reviewCount: number}>>} newest first
   */
  const weeklyReviewCounts = async (userId) =>
    TimeEntry.aggregate([
      { $match: { personId: mongoose.Types.ObjectId(userId), isTangible: true } },
      { $lookup: { from: 'tasks', localField: 'taskId', foreignField: '_id', as: 'taskInfo' } },
      { $unwind: '$taskInfo' },
      { $match: { 'taskInfo.taskName': { $regex: /review|pr/i } } },
      {
        $group: {
          _id: {
            year: { $year: { $toDate: '$dateOfWork' } },
            week: { $week: { $toDate: '$dateOfWork' } },
          },
          reviewedTaskIds: { $addToSet: '$taskId' },
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          week: '$_id.week',
          reviewCount: { $size: '$reviewedTaskIds' },
        },
      },
      { $sort: { year: -1, week: -1 } },
    ]);

  /**
   * Resolve the "Review for This Week" group the caller asked to see.
   *
   * Returns null when the whole table is wanted, which is both the default and
   * what the All Members group means. Falls back to the spec's default ranges
   * when no group has been stored yet, so a filtered read works on a fresh
   * database without this read path writing anything.
   */
  const resolveRequestedGroup = async (groupKey) => {
    if (!groupKey || groupKey === 'all') return null;

    const stored = ReviewerGroup ? await ReviewerGroup.find({}).lean() : [];
    const groups = stored.length ? stored : DEFAULT_REVIEWER_GROUPS;

    return groups.find((group) => group.key === groupKey) || undefined;
  };

  const getPromotionEligibilityData = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'getReports'))) {
      return res.status(403).send('You are not authorized to view promotion eligibility data.');
    }

    try {
      // One clock for the whole read, so every reviewer is measured against the
      // same "now" and two rows cannot land on different sides of a week
      // boundary partway through the loop.
      const now = new Date();

      // `undefined` means the key was supplied but matches nothing, which is a
      // stale dropdown on the client rather than a request for the whole table.
      const group = await resolveRequestedGroup(req.body.groupKey);
      if (group === undefined) {
        return res.status(400).send(`No reviewer group with key: ${req.body.groupKey}`);
      }

      // Promoted reviewers leave the lettered groups but stay under All
      // Members, per the spec: "Keep them in the All Members filter in case we
      // ever want to see how they did with training".
      //
      // Only an explicit `groupKey: "all"` brings them back. Omitting the key
      // keeps the exact behaviour the current page already has, so nothing
      // that exists today changes until the frontend opts in.
      const excludedRoles =
        req.body.groupKey === 'all'
          ? ['Owner', 'Administrator']
          : ['Owner', 'Administrator', PROMOTED_ROLE];

      const users = await UserProfile.find(
        {
          isActive: true,
          role: { $nin: excludedRoles },
        },
        '_id firstName lastName weeklycommittedHours createdDate role',
      ).lean();

      // Group membership is derived from the reviewer's name rather than stored,
      // so the filter happens here in memory. Doing it before the per-reviewer
      // queries below matters: those run one aggregation and one count each, so
      // a narrow group does proportionally less database work.
      const scopedUsers = group ? users.filter((user) => isReviewerInGroup(user, group)) : users;

      // Existing records are read up front, in one query rather than one per
      // user, because PRs Needed has to know the previously calculated hours to
      // detect a change and whether an Owner has overridden the figure.
      const existingRecords = await PromotionEligibility.find(
        { reviewerId: { $in: scopedUsers.map((user) => user._id) } },
        'reviewerId pledgedHours prsNeededOverride',
      ).lean();
      const recordsByReviewerId = new Map(
        existingRecords.map((record) => [record.reviewerId.toString(), record]),
      );

      // Refactor: Use map and Promise.all for concurrent processing
      const eligibilityPromises = scopedUsers.map(async (user) => {
        const pledgedHours = user.weeklycommittedHours || 0;
        const { prsNeeded, prsNeededSource, committedHoursChanged } = resolvePrsNeeded({
          committedHours: pledgedHours,
          existingRecord: recordsByReviewerId.get(user._id.toString()) || null,
        });

        const totalReviews = await Task.countDocuments({
          resources: { $elemMatch: { userID: user._id, completedTask: true } },
          taskName: { $regex: /review|pr/i },
        });

        const { successfulWeeks, remainingWeeks, weeklyRequirementsMet } = summariseWeeks({
          weeklyCounts: await weeklyReviewCounts(user._id),
          prsNeeded,
          currentWeek: mongoWeekOf(now),
        });

        // The spec splits the table into "New Members (joined <= 1 week ago)"
        // and "Existing Members (older than a week)".
        const isNewMember = now - new Date(user.createdDate) <= ONE_WEEK_MS;

        const dataEntry = {
          reviewerId: user._id,
          reviewerName: `${user.firstName} ${user.lastName}`,
          pledgedHours,
          // `requiredPRs` is the field the current page reads. It carries the
          // same value as `prsNeeded` so the rebuild can move across without a
          // flag day, and is dropped once the frontend reads `prsNeeded`.
          requiredPRs: prsNeeded,
          prsNeeded,
          prsNeededSource,
          committedHoursChanged,
          totalReviews,
          // Prior weeks in which the reviewer cleared `prsNeeded`. Exposed
          // alongside `remainingWeeks` so the page can show the progress rather
          // than only what is left.
          successfulWeeks,
          remainingWeeks,
          isNewMember,
          // Per the spec, whether the requirement is met "for the current
          // period", meaning this week. It is no longer a synonym for being
          // eligible to promote, which is `remainingWeeks === 0`.
          weeklyRequirementsMet,
          // Only ever true under All Members, since promoted reviewers are
          // filtered out of every other view. The role is the source of truth.
          isPromoted: user.role === PROMOTED_ROLE,
          calculatedAt: now,
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

  /**
   * Owner-only edit of a reviewer's PRs Needed figure.
   *
   * Sending a number pins the figure and stops it tracking committed hours.
   * Sending null clears the override and hands the reviewer back to the bands.
   */
  const updatePrsNeeded = async (req, res) => {
    if (req.body.requestor.role !== 'Owner') {
      return res.status(403).send('Only an Owner can edit PRs Needed.');
    }

    const { reviewerId } = req.params;
    const { prsNeeded } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewerId)) {
      return res.status(400).send(`Invalid reviewer ID: ${reviewerId}`);
    }

    const isClearing = prsNeeded === null;
    if (!isClearing && (!Number.isInteger(prsNeeded) || prsNeeded < 0)) {
      return res
        .status(400)
        .send('prsNeeded must be a non-negative whole number, or null to clear the override.');
    }

    try {
      const updated = await PromotionEligibility.findOneAndUpdate(
        { reviewerId },
        {
          $set: {
            prsNeededOverride: isClearing ? null : prsNeeded,
            prsNeededOverrideBy: isClearing ? null : req.body.requestor.requestorId,
            prsNeededOverrideAt: isClearing ? null : new Date(),
            prsNeededSource: isClearing ? 'auto' : 'ownerOverride',
            // An override replaces the committed hours check, so any pending
            // change flag is no longer something the page should act on.
            committedHoursChanged: false,
            ...(isClearing ? {} : { prsNeeded, requiredPRs: prsNeeded }),
          },
        },
        { new: true },
      );

      // Reviewers only get a record once the dashboard has been loaded at least
      // once, so a missing one means the id is not on the table rather than that
      // the write failed.
      if (!updated) {
        return res.status(404).send('No promotion eligibility record for that reviewer.');
      }

      logger.logInfo(
        `PRs Needed for reviewer ${reviewerId} ${
          isClearing ? 'reset to automatic' : `overridden to ${prsNeeded}`
        }`,
        { action: 'updatePrsNeeded', updatedBy: req.body.requestor.requestorId },
      );

      return res.status(200).json(updated);
    } catch (error) {
      logger.logException(error, { endpoint: 'updatePrsNeeded', payload: req.body });
      return res.status(500).send('Error updating PRs Needed.');
    }
  };

  /**
   * Work out where a set of reviewers would be placed, without writing anything.
   *
   * This backs the spec's confirmation modal, which has to show the proposed
   * team for each person and let it be changed by hand before anything
   * happens. Preview and commit deliberately share `buildPlacements`, so what
   * the modal shows is what the commit does.
   */
  const buildPlacements = async (memberIds) => {
    const objectIds = memberIds.map((id) => mongoose.Types.ObjectId(id));

    const users = await UserProfile.find(
      { _id: { $in: objectIds } },
      '_id firstName lastName weeklycommittedHours',
    ).lean();

    // Only configured teams can receive anyone, so the query is filtered to
    // those rather than pulling all 1000+ teams into memory.
    const teams = Team
      ? (
          await Team.find(
            {
              isActive: true,
              hoursBand: { $ne: null },
              standupDay: { $ne: null },
              standupTime: { $ne: null },
            },
            '_id teamName hoursBand standupDay standupTime standupTimezone members',
          ).lean()
        ).filter(isPlaceableTeam)
      : [];

    const formsByUserId = new Map();
    if (HgnFormResponses) {
      const forms = await HgnFormResponses.find(
        { user_id: { $in: memberIds } },
        'user_id general.availability',
      ).lean();
      forms.forEach((form) => formsByUserId.set(String(form.user_id), form));
    }

    const usersById = new Map(users.map((user) => [String(user._id), user]));

    return memberIds.map((id) => {
      const user = usersById.get(String(id));
      if (!user) {
        return {
          reviewerId: id,
          reviewerName: null,
          reason: 'reviewerNotFound',
          needsReview: true,
        };
      }

      const outcome = placeReviewer({
        committedHours: user.weeklycommittedHours,
        formResponse: formsByUserId.get(String(id)) || null,
        teams,
      });

      return {
        reviewerId: String(user._id),
        reviewerName: `${user.firstName} ${user.lastName}`,
        committedHours: user.weeklycommittedHours || 0,
        band: outcome.band,
        teamId: outcome.team ? String(outcome.team._id) : null,
        teamName: outcome.team ? outcome.team.teamName : null,
        standupDay: outcome.team ? outcome.team.standupDay : null,
        standupTime: outcome.team ? outcome.team.standupTime : null,
        reason: outcome.reason,
        needsReview: outcome.needsReview,
      };
    });
  };

  const previewPromotions = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'putUserProfile'))) {
      return res.status(403).send('You are not authorized to promote members.');
    }

    const { memberIds } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).send('No member IDs provided for promotion.');
    }

    const invalid = memberIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalid.length) {
      return res.status(400).send(`Invalid member ID: ${invalid[0]}`);
    }

    try {
      const placements = await buildPlacements(memberIds);

      // Surfaced separately from the rows so the modal can lead with what a
      // human has to look at rather than making them scan every line.
      const warnings = [];
      if (!Team) {
        warnings.push('Team placement is unavailable, so no team will be assigned.');
      }
      const unplaced = placements.filter((p) => !p.teamId).length;
      if (unplaced) {
        warnings.push(`${unplaced} of ${placements.length} could not be placed on a team.`);
      }
      const guessed = placements.filter((p) => p.teamId && p.needsReview).length;
      if (guessed) {
        warnings.push(`${guessed} placed without matching availability, please check.`);
      }

      return res.status(200).json({ placements, warnings });
    } catch (error) {
      logger.logException(error, { endpoint: 'previewPromotions', payload: req.body });
      return res.status(500).send('Error previewing promotions.');
    }
  };

  const promoteMembers = async (req, res) => {
    if (!(await hasPermission(req.body.requestor, 'putUserProfile'))) {
      return res.status(403).send('You are not authorized to promote members.');
    }

    const { memberIds, placements } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).send('No member IDs provided for promotion.');
    }

    // Optional. Omitting it keeps the original behaviour, a role change with
    // no team assignment, so the existing page keeps working untouched. When
    // present these are the rows the confirmation modal showed, including any
    // the user changed by hand, which is why they are trusted over
    // recalculating: the whole point of the modal is that a human can override.
    const placementsByReviewerId = new Map();
    if (placements !== undefined) {
      if (!Array.isArray(placements)) {
        return res.status(400).send('placements must be an array when provided.');
      }
      if (!Team) {
        return res.status(400).send('Team placement is unavailable on this deployment.');
      }

      const invalidPlacement = placements.find(
        (entry) =>
          !entry ||
          !mongoose.Types.ObjectId.isValid(entry.reviewerId) ||
          (entry.teamId !== null &&
            entry.teamId !== undefined &&
            !mongoose.Types.ObjectId.isValid(entry.teamId)),
      );
      if (invalidPlacement) {
        return res.status(400).send('Each placement needs a valid reviewerId and teamId or null.');
      }

      const unknown = placements.find(
        (entry) => !memberIds.some((id) => String(id) === String(entry.reviewerId)),
      );
      if (unknown) {
        return res
          .status(400)
          .send(`Placement for ${unknown.reviewerId}, who is not in memberIds.`);
      }

      const teamIds = [...new Set(placements.map((e) => e.teamId).filter(Boolean))];
      if (teamIds.length) {
        const found = await Team.countDocuments({ _id: { $in: teamIds } });
        if (found !== teamIds.length) {
          return res.status(400).send('One or more placement teams do not exist.');
        }
      }

      placements.forEach((entry) => {
        if (entry.teamId) placementsByReviewerId.set(String(entry.reviewerId), entry.teamId);
      });
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
          user.role = PROMOTED_ROLE;

          // Team assignment, only when the caller sent one. Without
          // `placements` this behaves exactly as it did before: role change
          // only, no team touched.
          const teamId = placementsByReviewerId.get(String(memberId));
          if (teamId) {
            if (!(user.teams || []).some((existing) => String(existing) === String(teamId))) {
              user.teams = [...(user.teams || []), mongoose.Types.ObjectId(teamId)];
            }
          }

          await user.save({ session });
          promotedMembers.push({
            id: memberId,
            name: `${user.firstName} ${user.lastName}`,
            teamId: teamId || null,
          });

          if (teamId) {
            // Mirrors assignTeamToUsers in teamController: membership lives on
            // both sides, so writing only one of them leaves the team looking
            // empty on the Teams page.
            const alreadyMember = await Team.exists({
              _id: teamId,
              'members.userId': mongoose.Types.ObjectId(memberId),
            });
            if (!alreadyMember) {
              await Team.findByIdAndUpdate(
                teamId,
                {
                  $push: { members: { userId: memberId, visible: true, addDateTime: new Date() } },
                  $set: { modifiedDatetime: Date.now() },
                },
                { session },
              );
            }
          }

          await PromotionEligibility.findOneAndUpdate(
            { reviewerId: memberId },
            {
              $set: {
                isPromoted: true,
                promotionDate: new Date(),
                ...(teamId ? { assignedTeamId: teamId } : {}),
              },
            },
            { new: true, session },
          );

          // The profile's role and teams both changed, so a cached copy is now
          // wrong. The role change had this problem before team assignment was
          // added, it is just more visible now.
          if (cache.hasCache(`user-${memberId}`)) cache.removeCache(`user-${memberId}`);
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

  return { getPromotionEligibilityData, updatePrsNeeded, previewPromotions, promoteMembers };
};

module.exports = promotionEligibilityController;
