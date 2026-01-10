const geoIP = require('geoip-lite');
const fallbackApplicantSources = require('../data/applicantSourcesFallback.json');

const analyticsController = function (
  Applicant,
  AnonymousInteraction,
  AnonymousApplication,
  AnalyticsSummary,
) {
  // Helper function to extract location from request
  const getLocationFromRequest = (req) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      const location = geoIP.lookup(ip);

      return {
        country: location?.country || 'Unknown',
        state: location?.region || 'Unknown',
      };
    } catch (error) {
      console.error('Location detection error:', error);
      return {
        country: 'Unknown',
        state: 'Unknown',
      };
    }
  };

  // Helper function to detect device type from user agent
  const getDeviceType = (userAgent) => {
    if (!userAgent) return 'desktop';
    const ua = userAgent.toLowerCase();
    if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua)) {
      return 'mobile';
    }
    if (/tablet|ipad/.test(ua)) {
      return 'tablet';
    }
    return 'desktop';
  };

  // Helper function to determine origin from referrer
  const getOrigin = (referrer) => {
    if (!referrer || referrer === '') return 'direct';
    try {
      const domain = new URL(referrer).hostname.toLowerCase();
      if (domain.includes('google') || domain.includes('bing') || domain.includes('yahoo')) {
        return 'search';
      }
      if (
        domain.includes('facebook') ||
        domain.includes('twitter') ||
        domain.includes('linkedin') ||
        domain.includes('instagram')
      ) {
        return 'social';
      }
      if (domain.includes('gmail') || domain.includes('outlook') || domain.includes('mail')) {
        return 'email';
      }
      return 'referral';
    } catch (error) {
      return 'other';
    }
  };

  // Experience breakdown - shows all-time data (roles filtering supported)
  const getExperienceBreakdown = async (req, res) => {
    try {
      // Check admin/owner permissions
      if (req.body.requestor.role !== 'Owner' && req.body.requestor.role !== 'Administrator') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { roles } = req.query;
      const pipeline = [];

      // Filter by roles only
      if (roles) {
        const rolesArray = Array.isArray(roles) ? roles : roles.split(',');
        pipeline.push({
          $match: {
            roles: { $in: rolesArray },
          },
        });
      }

      // Add experience category
      pipeline.push({
        $addFields: {
          experienceCategory: {
            $switch: {
              branches: [
                { case: { $lte: ['$experience', 1] }, then: '0-1 years' },
                {
                  case: {
                    $and: [{ $gt: ['$experience', 1] }, { $lte: ['$experience', 3] }],
                  },
                  then: '1-3 years',
                },
                {
                  case: {
                    $and: [{ $gt: ['$experience', 3] }, { $lte: ['$experience', 5] }],
                  },
                  then: '3-5 years',
                },
              ],
              default: '5+ years',
            },
          },
        },
      });

      // Group by category
      pipeline.push({
        $group: {
          _id: '$experienceCategory',
          count: { $sum: 1 },
        },
      });

      // Final format
      pipeline.push({
        $project: {
          _id: 0,
          experience: '$_id',
          count: 1,
        },
      });

      const breakdown = await Applicant.aggregate(pipeline);

      if (!breakdown.length) {
        return res.status(404).json({ message: 'No Data Available' });
      }

      const total = breakdown.reduce((sum, item) => sum + item.count, 0);
      const data = breakdown.map((item) => ({
        ...item,
        percentage: ((item.count / total) * 100).toFixed(2),
      }));

      return res.status(200).json(data);
    } catch (error) {
      console.error('Error fetching experience breakdown:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // Track anonymous interactions (public endpoint)
  const trackInteraction = async (req, res) => {
    try {
      const {
        sessionId,
        interactionType,
        targetId,
        targetTitle,
        sessionDuration = 0,
        metadata = {},
      } = req.body;

      // Validate required fields
      if (!sessionId || !interactionType || !targetId || !targetTitle) {
        return res.status(400).json({
          error: 'Missing required fields: sessionId, interactionType, targetId, targetTitle',
        });
      }

      // Extract privacy-safe data from request
      const location = getLocationFromRequest(req);
      const deviceType = getDeviceType(req.get('User-Agent'));
      const origin = getOrigin(req.get('Referer'));
      const referrer = req.get('Referer') ? new URL(req.get('Referer')).hostname : '';

      // Create interaction record
      const interaction = new AnonymousInteraction({
        sessionId,
        interactionType,
        targetId,
        targetTitle,
        location,
        deviceType,
        origin,
        sessionDuration,
        referrer,
        metadata,
      });

      await interaction.save();

      return res.status(201).json({
        success: true,
        message: 'Interaction tracked successfully',
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // Track anonymous applications (public endpoint)
  const trackApplication = async (req, res) => {
    try {
      const {
        sessionId,
        jobId,
        jobTitle,
        applicationSource = 'job_listing',
        conversionTime = 0,
        interactionsBeforeApplication = 0,
        metadata = {},
      } = req.body;

      // Validate required fields
      if (!sessionId || !jobId || !jobTitle) {
        return res.status(400).json({
          error: 'Missing required fields: sessionId, jobId, jobTitle',
        });
      }

      // Extract privacy-safe data from request
      const location = getLocationFromRequest(req);
      const deviceType = getDeviceType(req.get('User-Agent'));
      const origin = getOrigin(req.get('Referer'));
      const referrer = req.get('Referer') ? new URL(req.get('Referer')).hostname : '';

      // Create application record
      const application = new AnonymousApplication({
        sessionId,
        jobId,
        jobTitle,
        location,
        deviceType,
        origin,
        applicationSource,
        conversionTime,
        interactionsBeforeApplication,
        referrer,
        metadata,
      });

      await application.save();

      return res.status(201).json({
        success: true,
        message: 'Application tracked successfully',
      });
    } catch (error) {
      console.error('Error tracking application:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // Get interaction summary (admin/owner only)
  const getInteractionSummary = async (req, res) => {
    try {
      // Check admin/owner permissions
      if (req.body.requestor.role !== 'Owner' && req.body.requestor.role !== 'Administrator') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { startDate, endDate, summaryType = 'daily' } = req.query;
      const match = { summaryType };

      // Validate date range
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
          return res.status(400).json({
            error: 'Invalid date range: startDate cannot be after endDate',
          });
        }
      }

      // Filter by date range
      if (startDate || endDate) {
        match.date = {};
        if (startDate) match.date.$gte = new Date(startDate);
        if (endDate) match.date.$lte = new Date(endDate);
      }

      const summaries = await AnalyticsSummary.find(match).sort({ date: -1 }).limit(100);

      if (!summaries.length) {
        return res.status(404).json({ message: 'No analytics data available' });
      }

      return res.status(200).json(summaries);
    } catch (error) {
      console.error('Error fetching interaction summary:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // Get conversion metrics (admin/owner only)
  const getConversionMetrics = async (req, res) => {
    try {
      // Check admin/owner permissions
      if (req.body.requestor.role !== 'Owner' && req.body.requestor.role !== 'Administrator') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { startDate, endDate } = req.query;
      const dateMatch = {};

      if (startDate || endDate) {
        if (startDate) dateMatch.$gte = new Date(startDate);
        if (endDate) dateMatch.$lte = new Date(endDate);
      }

      // Get conversion data from raw collections (for real-time data)
      const interactions = await AnonymousInteraction.aggregate([
        ...(Object.keys(dateMatch).length ? [{ $match: { timestamp: dateMatch } }] : []),
        {
          $group: {
            _id: null,
            totalSessions: { $addToSet: '$sessionId' },
            totalInteractions: { $sum: 1 },
            deviceBreakdown: {
              $push: '$deviceType',
            },
            originBreakdown: {
              $push: '$origin',
            },
          },
        },
        {
          $project: {
            totalSessions: { $size: '$totalSessions' },
            totalInteractions: 1,
            deviceBreakdown: 1,
            originBreakdown: 1,
          },
        },
      ]);

      const applications = await AnonymousApplication.aggregate([
        ...(Object.keys(dateMatch).length ? [{ $match: { submittedAt: dateMatch } }] : []),
        {
          $group: {
            _id: null,
            totalApplications: { $sum: 1 },
            avgConversionTime: { $avg: '$conversionTime' },
            topJobs: {
              $push: {
                jobId: '$jobId',
                jobTitle: '$jobTitle',
              },
            },
          },
        },
      ]);

      const interactionData = interactions[0] || { totalSessions: 0, totalInteractions: 0 };
      const applicationData = applications[0] || { totalApplications: 0, avgConversionTime: 0 };

      const conversionRate =
        interactionData.totalSessions > 0
          ? ((applicationData.totalApplications / interactionData.totalSessions) * 100).toFixed(2)
          : 0;

      return res.status(200).json({
        summary: {
          totalSessions: interactionData.totalSessions,
          totalInteractions: interactionData.totalInteractions,
          totalApplications: applicationData.totalApplications,
          conversionRate: parseFloat(conversionRate),
          avgConversionTime: Math.round(applicationData.avgConversionTime || 0),
        },
        deviceBreakdown: interactionData.deviceBreakdown || [],
        originBreakdown: interactionData.originBreakdown || [],
        topJobs: applicationData.topJobs || [],
      });
    } catch (error) {
      console.error('Error fetching conversion metrics:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // Manual aggregation trigger (admin/owner only) - backup for cron job
  const triggerAggregation = async (req, res) => {
    try {
      // Check admin/owner permissions
      if (req.body.requestor.role !== 'Owner' && req.body.requestor.role !== 'Administrator') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { startDate, endDate } = req.query;
      const { backfillSummaries, generateDailySummary } = require('../jobs/analyticsAggregation');

      if (startDate && endDate) {
        // Backfill range of dates
        const summaries = await backfillSummaries(startDate, endDate);
        return res.status(200).json({
          message: `Generated ${summaries.length} daily summaries`,
          dateRange: { startDate, endDate },
          summariesCount: summaries.length,
        });
      }

      // Generate for yesterday (or today if specified)
      const targetDate = req.query.date ? new Date(req.query.date) : new Date();
      if (!req.query.date) {
        targetDate.setDate(targetDate.getDate() - 1); // Default to yesterday
      }

      const summary = await generateDailySummary(targetDate);
      return res.status(200).json({
        message: 'Daily summary generated successfully',
        date: targetDate.toDateString(),
        summary,
      });
    } catch (error) {
      console.error('Error triggering aggregation:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  const parseDateOrNull = (raw) => {
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const buildSourcePipeline = (match) => [
    { $match: match },
    {
      $group: {
        _id: '$source',
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        source: '$_id',
        count: 1,
      },
    },
  ];

  const fetchSourceCounts = (query) => Applicant.aggregate(buildSourcePipeline(query));

  const appendPercentages = (rawData) => {
    const total = rawData.reduce((sum, entry) => sum + entry.count, 0);
    return {
      total,
      data: rawData.map((entry) => ({
        source: entry.source,
        count: entry.count,
        percentage: total > 0 ? Number(((entry.count / total) * 100).toFixed(2)) : 0,
      })),
    };
  };

  const formatSourcesForResponse = (dataset) =>
    dataset.map((item) => ({
      name: item.source || item.name || 'Unknown',
      value: item.count,
      percentage: item.percentage ?? 0,
    }));

  const buildPreviousRange = (start, end, type) => {
    if (!start || !end || !type) return null;

    const duration = end.getTime() - start.getTime();
    if (duration < 0) return null;

    const normalizedType = type.toLowerCase();
    if (!['week', 'month', 'year'].includes(normalizedType)) {
      return null;
    }

    const previousStart = new Date(start);
    const previousEnd = new Date(end);

    if (normalizedType === 'week') {
      previousStart.setTime(start.getTime() - duration);
      previousEnd.setTime(end.getTime() - duration);
    } else if (normalizedType === 'month') {
      previousStart.setMonth(start.getMonth() - 1);
      previousEnd.setMonth(end.getMonth() - 1);
    } else if (normalizedType === 'year') {
      previousStart.setFullYear(start.getFullYear() - 1);
      previousEnd.setFullYear(end.getFullYear() - 1);
    }

    return { previousStart, previousEnd, label: normalizedType };
  };

  const buildComparisonSummary = (current, previous, label) => {
    if (!previous) {
      return {
        text: `${current.total} applicants`,
        payload: null,
      };
    }

    const previousLookup = new Map(previous.data.map((entry) => [entry.source, entry]));
    const comparisonRows = current.data.map((entry) => {
      const previousEntry = previousLookup.get(entry.source) || { count: 0, percentage: 0 };
      const percentageChange =
        previousEntry.percentage > 0
          ? Number(
              (
                ((entry.percentage - previousEntry.percentage) / previousEntry.percentage) *
                100
              ).toFixed(2),
            )
          : entry.count > 0
            ? 100
            : 0;

      return {
        name: entry.source || 'Unknown',
        value: entry.count,
        previousCount: previousEntry.count || 0,
        previousPercentage: Number(previousEntry.percentage || 0),
        percentageChange,
      };
    });

    const previousTotal = previous.total;
    const delta =
      previousTotal > 0
        ? Number((((current.total - previousTotal) / previousTotal) * 100).toFixed(1))
        : current.total > 0
          ? 100
          : 0;

    const text = `${current.total} applicants\n${delta >= 0 ? '+' : ''}${delta}% vs last ${label}`;

    return {
      text,
      payload: {
        type: label,
        previousTotal,
        data: comparisonRows,
      },
    };
  };

  // Get applicant sources breakdown with comparison logic
  const getApplicantSources = async (req, res) => {
    try {
      if (req.body.requestor.role !== 'Owner' && req.body.requestor.role !== 'Administrator') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { startDate, endDate, roles, comparisonType } = req.query;

      const parsedStart = parseDateOrNull(startDate);
      const parsedEnd = parseDateOrNull(endDate);

      if ((startDate && !parsedStart) || (endDate && !parsedEnd)) {
        return res.status(400).json({ error: 'Invalid startDate or endDate supplied' });
      }

      if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
        return res.status(400).json({ error: 'startDate cannot be after endDate' });
      }

      const match = {};
      if (roles) {
        const rolesArray = Array.isArray(roles) ? roles : roles.split(',');
        match.roles = { $in: rolesArray };
      }

      if (parsedStart && parsedEnd) {
        match.startDate = {
          $gte: parsedStart.toISOString(),
          $lte: parsedEnd.toISOString(),
        };
      }

      const currentRaw = await fetchSourceCounts(match);
      const current = appendPercentages(currentRaw);

      if (current.total === 0) {
        return res.status(200).json(fallbackApplicantSources);
      }

      let comparisonPayload = null;
      let comparisonText = `${current.total} applicants`;

      if (comparisonType && parsedStart && parsedEnd) {
        const previousRange = buildPreviousRange(parsedStart, parsedEnd, comparisonType);

        if (previousRange) {
          const previousMatch = {
            ...match,
            startDate: {
              $gte: previousRange.previousStart.toISOString(),
              $lte: previousRange.previousEnd.toISOString(),
            },
          };

          const previousRaw = await fetchSourceCounts(previousMatch);
          const previous = appendPercentages(previousRaw);

          const { text, payload } = buildComparisonSummary(current, previous, previousRange.label);
          comparisonText = text;
          comparisonPayload = payload;
        }
      }

      const sources = formatSourcesForResponse(current.data);

      return res.status(200).json({
        sources,
        total: current.total,
        comparisonText,
        comparison: comparisonPayload,
      });
    } catch (error) {
      console.error('Error fetching applicant sources:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  const getAllRoles = async (req, res) => {
    try {
      const roles = await Applicant.distinct('roles');
      return res.status(200).json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return {
    getExperienceBreakdown,
    getApplicantSources,
    getAllRoles,
    trackInteraction,
    trackApplication,
    getInteractionSummary,
    getConversionMetrics,
    triggerAggregation,
  };
};

module.exports = analyticsController;
