// src/controllers/reviewerGroupController.js
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const {
  DEFAULT_REVIEWER_GROUPS,
  validateRange,
  rangeWarnings,
  slugifyGroupKey,
} = require('../helpers/reviewerGroupHelper');

/**
 * Reviewer groups behind the "Review for This Week" dropdown (doc item #23).
 *
 * Membership is derived from each group's alphabetical range rather than
 * stored, so these handlers only ever manage the ranges themselves. The
 * promotion eligibility read applies them when filtering the table.
 */
const reviewerGroupController = function (ReviewerGroup) {
  const sortGroups = (groups) =>
    [...groups].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.label.localeCompare(b.label),
    );

  /**
   * Read every group, seeding the spec's three defaults the first time.
   *
   * Seeding here rather than in a migration means a fresh database, and any
   * teammate's local copy, works without a deploy step. It only fires when the
   * collection is completely empty, so a deliberately deleted group stays
   * deleted.
   */
  const loadGroups = async () => {
    const existing = await ReviewerGroup.find({}).lean();
    if (existing.length) return sortGroups(existing);

    await ReviewerGroup.bulkWrite(
      DEFAULT_REVIEWER_GROUPS.map((group) => ({
        updateOne: {
          filter: { key: group.key },
          update: { $setOnInsert: group },
          upsert: true,
        },
      })),
    );

    return sortGroups(await ReviewerGroup.find({}).lean());
  };

  const getReviewerGroups = async (req, res) => {
    // Same gate as the dashboard read itself, so a viewer who can see the table
    // can always see the dropdown that filters it.
    if (!(await hasPermission(req.body.requestor, 'getReports'))) {
      return res.status(403).send('You are not authorized to view reviewer groups.');
    }

    try {
      const groups = await loadGroups();
      return res.status(200).json({ groups, warnings: rangeWarnings(groups) });
    } catch (error) {
      logger.logException(error, { endpoint: 'getReviewerGroups' });
      return res.status(500).send('Error fetching reviewer groups.');
    }
  };

  const createReviewerGroup = async (req, res) => {
    if (req.body.requestor.role !== 'Owner') {
      return res.status(403).send('Only an Owner can add a reviewer group.');
    }

    const { label, rangeStart, rangeEnd } = req.body;

    if (typeof label !== 'string' || !label.trim()) {
      return res.status(400).send('A group label is required.');
    }

    const range = validateRange({ rangeStart, rangeEnd });
    if (!range.valid) {
      return res.status(400).send(range.error);
    }

    try {
      const groups = await loadGroups();

      // The key is what the frontend sends back to filter the table, so it is
      // derived once here and never changes, even if the label is renamed later.
      const key = slugifyGroupKey(
        label,
        groups.map((group) => group.key),
      );
      if (!key) {
        return res
          .status(400)
          .send('That label contains no letters or numbers to build a key from.');
      }

      const sortOrder =
        groups.reduce((highest, group) => Math.max(highest, group.sortOrder || 0), -1) + 1;

      const doc = {
        key,
        label: label.trim(),
        rangeStart: range.rangeStart,
        rangeEnd: range.rangeEnd,
        editable: true,
        sortOrder,
        updatedBy: req.body.requestor.requestorId,
        updatedAt: new Date(),
      };

      const created = await ReviewerGroup.create(doc);

      logger.logInfo(`Reviewer group ${key} created covering ${doc.rangeStart}-${doc.rangeEnd}`, {
        action: 'createReviewerGroup',
        createdBy: req.body.requestor.requestorId,
      });

      return res.status(201).json({ group: created, warnings: rangeWarnings([...groups, doc]) });
    } catch (error) {
      logger.logException(error, { endpoint: 'createReviewerGroup', payload: req.body });
      return res.status(500).send('Error creating reviewer group.');
    }
  };

  const updateReviewerGroup = async (req, res) => {
    if (req.body.requestor.role !== 'Owner') {
      return res.status(403).send('Only an Owner can edit a reviewer group.');
    }

    const { groupKey } = req.params;
    const { label, rangeStart, rangeEnd } = req.body;

    try {
      const groups = await loadGroups();
      const target = groups.find((group) => group.key === groupKey);

      if (!target) {
        return res.status(404).send(`No reviewer group with key: ${groupKey}`);
      }
      if (target.editable === false) {
        return res.status(403).send(`The ${target.label} group cannot be edited.`);
      }

      const hasLabel = label !== undefined;
      const hasRange = rangeStart !== undefined || rangeEnd !== undefined;

      if (!hasLabel && !hasRange) {
        return res.status(400).send('Supply a label, a range, or both.');
      }
      if (hasLabel && (typeof label !== 'string' || !label.trim())) {
        return res.status(400).send('A group label cannot be empty.');
      }

      const $set = {
        updatedBy: req.body.requestor.requestorId,
        updatedAt: new Date(),
      };

      if (hasLabel) $set.label = label.trim();

      if (hasRange) {
        // Both boundaries are required together. Accepting one would leave the
        // group holding half a range, which no caller can interpret.
        const range = validateRange({ rangeStart, rangeEnd });
        if (!range.valid) {
          return res.status(400).send(range.error);
        }
        $set.rangeStart = range.rangeStart;
        $set.rangeEnd = range.rangeEnd;
      }

      const updated = await ReviewerGroup.findOneAndUpdate(
        { key: groupKey },
        { $set },
        { new: true },
      ).lean();

      if (!updated) {
        return res.status(404).send(`No reviewer group with key: ${groupKey}`);
      }

      logger.logInfo(`Reviewer group ${groupKey} updated`, {
        action: 'updateReviewerGroup',
        updatedBy: req.body.requestor.requestorId,
      });

      // Overlaps and gaps are reported, not refused. Refusing them would stop an
      // Owner widening A-N to A-P before shrinking O-Z, and since a group is a
      // filter rather than an assignment, a double match is harmless.
      const projected = groups.map((group) =>
        group.key === groupKey ? { ...group, ...$set } : group,
      );

      return res.status(200).json({ group: updated, warnings: rangeWarnings(projected) });
    } catch (error) {
      logger.logException(error, { endpoint: 'updateReviewerGroup', payload: req.body });
      return res.status(500).send('Error updating reviewer group.');
    }
  };

  return { getReviewerGroups, createReviewerGroup, updateReviewerGroup };
};

module.exports = reviewerGroupController;
