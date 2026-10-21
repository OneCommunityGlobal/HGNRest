// Helper function to normalize prNumbers for comparison (removes all whitespace)
const normalizePrNumbers = (prNumbers) => prNumbers.replace(/\s+/g, '');

// Helper function to validate prNumbers regex
const validatePrNumbers = (prNumbers) => {
  const regex = /^\d+(?:\s*\+\s*\d+)*$/;
  return regex.test(prNumbers);
};

// Validate a single gradedPr entry
const validateGradedPr = (gradedPr) => {
  if (!gradedPr.prNumbers || !gradedPr.grade) {
    throw new Error(`Invalid gradedPr entry: missing prNumbers or grade`);
  }

  if (!validatePrNumbers(gradedPr.prNumbers)) {
    throw new Error(
      `Invalid prNumbers format: ${gradedPr.prNumbers}. Must match pattern: ^\\d+(?:\\s*\\+\\s*\\d+)*$`,
    );
  }

  const validGrades = ['Unsatisfactory', 'Okay', 'Exceptional', 'No Correct Image'];
  if (!validGrades.includes(gradedPr.grade)) {
    throw new Error(
      `Invalid grade value: ${gradedPr.grade}. Must be one of: ${validGrades.join(', ')}`,
    );
  }
};

const checkForDuplicatePRsInSubmission = (gradedPrs, reviewer) => {
  const seenPRs = new Set();
  for (const pr of gradedPrs) {
    const normalized = normalizePrNumbers(pr.prNumbers);
    if (seenPRs.has(normalized)) {
      throw new Error(
        `Duplicate PR number "${pr.prNumbers}" found in submission for reviewer: ${reviewer}`,
      );
    }
    seenPRs.add(normalized);
  }
};

// Validate a single grading entry
const validateGradingEntry = (grading) => {
  const { reviewer, prsReviewed, prsNeeded, gradedPrs } = grading;

  if (
    !reviewer ||
    prsReviewed === undefined ||
    prsNeeded === undefined ||
    !Array.isArray(gradedPrs)
  ) {
    throw new Error(`Invalid grading entry for reviewer: ${reviewer}`);
  }

  gradedPrs.forEach(validateGradedPr);

  checkForDuplicatePRsInSubmission(gradedPrs, reviewer);
};

// Merge gradedPrs from request with existing gradedPrs
const mergeGradedPrs = (existingGradedPrs, newGradedPrs) => {
  if (!existingGradedPrs || existingGradedPrs.length === 0) {
    return newGradedPrs;
  }

  const existingGradedPrsMap = new Map();
  existingGradedPrs.forEach((pr) => {
    const normalized = normalizePrNumbers(pr.prNumbers);
    existingGradedPrsMap.set(normalized, pr);
  });

  newGradedPrs.forEach((pr) => {
    const normalized = normalizePrNumbers(pr.prNumbers);
    existingGradedPrsMap.set(normalized, {
      prNumbers: pr.prNumbers,
      grade: pr.grade,
    });
  });

  return Array.from(existingGradedPrsMap.values());
};

// Create version history entry from existing entry
const createVersionHistoryEntry = (existingEntry) => {
  if (!existingEntry) return null;

  return {
    version: existingEntry.version || 1,
    prsNeeded: existingEntry.prsNeeded,
    prsReviewed: existingEntry.prsReviewed,
    gradedPrs: existingEntry.gradedPrs,
    updatedAt: existingEntry.updatedAt || existingEntry.createdAt,
  };
};

// Build update data for saving grading
const buildUpdateData = (params) => {
  const {
    teamCode,
    gradingDate,
    reviewer,
    prsNeeded,
    prsReviewed,
    mergedGradedPrs,
    newVersion,
    versionHistoryEntry,
  } = params;
  const updateData = {
    teamCode,
    date: gradingDate,
    reviewer,
    prsNeeded,
    prsReviewed,
    gradedPrs: mergedGradedPrs,
    version: newVersion,
  };

  if (versionHistoryEntry) {
    updateData.$push = { versionHistory: versionHistoryEntry };
  }

  return updateData;
};

// Calculate next version number
const calculateNextVersion = (existingEntry) => {
  const currentVersion = existingEntry?.version || 0;
  return currentVersion + 1;
};

// Save grading entry with versioning
const saveGradingEntry = async (weeklyGradingModel, query, updateData) => {
  await weeklyGradingModel.findOneAndUpdate(query, updateData, {
    upsert: true,
    new: true,
  });
};

const weeklyGradingController = function (weeklyGradingModel) {
  // Process and save a single reviewer's grading
  const processReviewerGrading = async (grading, teamCode, gradingDate) => {
    const { reviewer, prsReviewed, prsNeeded, gradedPrs } = grading;

    validateGradingEntry(grading);

    const query = { teamCode, date: gradingDate, reviewer };
    const existingEntry = await weeklyGradingModel.findOne(query);

    const mergedGradedPrs = mergeGradedPrs(existingEntry?.gradedPrs, gradedPrs);
    const newVersion = calculateNextVersion(existingEntry);
    const versionHistoryEntry = createVersionHistoryEntry(existingEntry);
    const updateData = buildUpdateData({
      teamCode,
      gradingDate,
      reviewer,
      prsNeeded,
      prsReviewed,
      mergedGradedPrs,
      newVersion,
      versionHistoryEntry,
    });

    await saveGradingEntry(weeklyGradingModel, query, updateData);
  };

  const getWeeklyGrading = async (req, res) => {
    try {
      const { team, date } = req.query;

      if (!team) {
        return res.status(400).json({ error: 'Team parameter is required' });
      }

      const query = { teamCode: team };

      // If date is provided, filter by that date
      if (date) {
        const gradingDate = new Date(date);
        if (Number.isNaN(gradingDate.getTime())) {
          return res.status(400).json({ error: 'Invalid date format' });
        }
        // Set to start of day for comparison
        const startOfDay = new Date(gradingDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(gradingDate);
        const HOURS_IN_DAY = 23;
        const MINUTES_IN_HOUR = 59;
        const SECONDS_IN_MINUTE = 59;
        const MILLISECONDS_IN_SECOND = 999;
        endOfDay.setHours(HOURS_IN_DAY, MINUTES_IN_HOUR, SECONDS_IN_MINUTE, MILLISECONDS_IN_SECOND);
        query.date = { $gte: startOfDay, $lte: endOfDay };
      }

      const gradingData = await weeklyGradingModel.find(query).lean();

      // Format response - one entry per reviewer
      const result = gradingData.map((entry) => ({
        reviewer: entry.reviewer,
        prsNeeded: entry.prsNeeded,
        prsReviewed: entry.prsReviewed,
        gradedPrs: entry.gradedPrs || [],
      }));

      return res.status(200).json(result);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching weekly grading:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  const saveWeeklyGrading = async (req, res) => {
    try {
      const { teamCode, date, gradings } = req.body;

      if (!teamCode || !date || !gradings || !Array.isArray(gradings)) {
        return res
          .status(400)
          .json({ error: 'Missing required fields: teamCode, date, and gradings array' });
      }

      const gradingDate = new Date(date);
      if (Number.isNaN(gradingDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      const updatePromises = gradings.map((grading) =>
        processReviewerGrading(grading, teamCode, gradingDate),
      );

      await Promise.all(updatePromises);

      return res.status(200).json({
        status: 'ok',
        message: 'Weekly grades saved successfully',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error saving weekly grading:', error);
      return res.status(500).json({
        error: error.message || 'Internal server error',
      });
    }
  };

  return {
    getWeeklyGrading,
    saveWeeklyGrading,
  };
};

module.exports = weeklyGradingController;
