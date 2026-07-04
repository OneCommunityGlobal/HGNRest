// Helper function to normalize prNumbers for comparison
const normalizePrNumbers = (prNumbers) => prNumbers.replace(/\s+/g, ' ').trim();

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
    teamName,
    gradingDate,
    reviewer,
    prsNeeded,
    prsReviewed,
    mergedGradedPrs,
    newVersion,
    versionHistoryEntry,
  } = params;
  const updateData = {
    teamName,
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
  const processReviewerGrading = async (grading, teamName, gradingDate) => {
    const { reviewer, prsReviewed, prsNeeded, gradedPrs } = grading;

    validateGradingEntry(grading);

    const query = { teamName, date: gradingDate, reviewer };
    const existingEntry = await weeklyGradingModel.findOne(query);

    const mergedGradedPrs = mergeGradedPrs(existingEntry?.gradedPrs, gradedPrs);
    const newVersion = calculateNextVersion(existingEntry);
    const versionHistoryEntry = createVersionHistoryEntry(existingEntry);
    const updateData = buildUpdateData({
      teamName,
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
      const { team, weekStart } = req.query;

      if (!team) {
        return res.status(400).json({ error: 'Team parameter is required' });
      }

      const query = { teamName: team };

      // If weekStart is provided, filter by the full 7-day week range (Sun–Sat)
      if (weekStart) {
        const startDate = new Date(weekStart);
        if (Number.isNaN(startDate.getTime())) {
          return res.status(400).json({ error: 'Invalid weekStart date format. Use YYYY-MM-DD.' });
        }
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);

        query.date = { $gte: startDate, $lte: endDate };
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
      const { teamName, date, gradings } = req.body;

      if (!teamName || !date || !gradings || !Array.isArray(gradings)) {
        return res
          .status(400)
          .json({ error: 'Missing required fields: teamName, date, and gradings array' });
      }

      const gradingDate = new Date(date);
      if (Number.isNaN(gradingDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Normalize to Sunday midnight UTC of the week the date falls in.
      // Any save made Mon–Sat will resolve to the same Sunday anchor,
      // so repeated saves within the same week always upsert the same document.
      const dayOfWeek = gradingDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
      gradingDate.setUTCDate(gradingDate.getUTCDate() - dayOfWeek);
      gradingDate.setUTCHours(0, 0, 0, 0);

      const updatePromises = gradings.map((grading) =>
        processReviewerGrading(grading, teamName, gradingDate),
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

  const deleteReviewerGrading = async (req, res) => {
    try {
      const { team, reviewer, weekStart } = req.query;

      if (!team || !reviewer || !weekStart) {
        return res.status(400).json({
          error: 'Missing required query params: team, reviewer, and weekStart',
        });
      }

      const startDate = new Date(weekStart);
      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid weekStart date format. Use YYYY-MM-DD.' });
      }
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      const result = await weeklyGradingModel.deleteOne({
        teamName: team,
        reviewer,
        date: { $gte: startDate, $lte: endDate },
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'No grading record found for the given parameters' });
      }

      return res.status(200).json({ message: `Reviewer "${reviewer}" removed successfully` });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error deleting reviewer grading:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    getWeeklyGrading,
    saveWeeklyGrading,
    deleteReviewerGrading,
  };
};

module.exports = weeklyGradingController;
