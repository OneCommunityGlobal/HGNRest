const geoIP = require('geoip-lite');
const fallbackApplicantSources = require('../data/applicantSourcesFallback.json');

// Same buckets the chart always used: a value on a boundary falls in the lower bucket
const EXPERIENCE_BUCKETS = [
  { label: '0-1 years', maxYears: 1 },
  { label: '1-3 years', maxYears: 3 },
  { label: '3-5 years', maxYears: 5 },
  { label: '5+ years', maxYears: Infinity },
];
const EXPERIENCE_CATEGORIES = EXPERIENCE_BUCKETS.map((b) => b.label);
// "5+" means more than 5, so nudge it past the boundary into the next bucket
const MORE_THAN_NUDGE_YEARS = 0.5;
const MONTHS_PER_YEAR = 12;
// Anything above this is treated as a typo rather than a career length
const MAX_PLAUSIBLE_YEARS = 60;
const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const YEARS_UNIT = String.raw`(?:years?|yrs?|y)?`;
// "2", "2 years", "2 yrs", "5+", "5+ years", "5 + yrs"
const PLAIN_YEARS = new RegExp(String.raw`^${NUMBER}\s*(\+)?\s*${YEARS_UNIT}\s*(\+)?$`, 'i');
// "6 months", "18 mos"
const MONTHS = new RegExp(String.raw`^${NUMBER}\s*(?:months?|mos?)$`, 'i');
// "1-3 years", "3 - 5", "3–5 years", "2 to 4 yrs" (a dropdown option)
const RANGE_YEARS = new RegExp(
  String.raw`^${NUMBER}\s*(?:-|–|—|to)\s*${NUMBER}\s*${YEARS_UNIT}$`,
  'i',
);
const PERCENT = 100;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
// Only the applicant's profile answer is needed, not every free-text answer
const PROFILE_PROJECTION = {
  submittedAt: 1,
  answers: { $elemMatch: { 'answer.type': 'applicantProfile' } },
};

const canViewApplicantAnalytics = (requestor) =>
  requestor && (requestor.role === 'Owner' || requestor.role === 'Administrator');

// Years come from a free-text answer or a dropdown option. Only clear shapes are read;
// anything else ("about 3", "1,5") counts as not reported rather than being guessed.
// A range goes to the bucket its midpoint falls in, so "1-3 years" lands in 1-3.
function parseExperienceYears(text) {
  const plain = text.match(PLAIN_YEARS);
  if (plain) {
    const moreThan = Boolean(plain[2] || plain[3]);
    return Number(plain[1]) + (moreThan ? MORE_THAN_NUDGE_YEARS : 0);
  }
  const months = text.match(MONTHS);
  if (months) return Number(months[1]) / MONTHS_PER_YEAR;
  const range = text.match(RANGE_YEARS);
  if (range && Number(range[1]) < Number(range[2])) {
    return (Number(range[1]) + Number(range[2])) / 2;
  }
  return null;
}

function toExperienceYears(raw) {
  if (raw === null || raw === undefined) return null;
  const years = parseExperienceYears(String(raw).trim());
  return years !== null && years <= MAX_PLAUSIBLE_YEARS ? years : null;
}

function experienceCategory(years) {
  return EXPERIENCE_BUCKETS.find((bucket) => years <= bucket.maxYears).label;
}

function getApplicantProfile(application) {
  const entry = (application.answers || []).find(
    (a) => a && a.answer && a.answer.type === 'applicantProfile',
  );
  return entry ? entry.answer : {};
}

// Returns null when roles isn't a string or a list of strings (e.g. ?roles[0][a]=1)
function parseRoles(roles) {
  if (!roles) return [];
  const list = Array.isArray(roles) ? roles : [roles];
  if (!list.every((r) => typeof r === 'string')) return null;
  // A single string may hold several comma-separated titles; send a list for titles with commas
  const titles = Array.isArray(roles) ? list : list[0].split(',');
  return titles.map((r) => r.trim().toLowerCase()).filter(Boolean);
}

// A bound is either an exact ISO instant (the chart sends the viewer's local day bounds) or a
// calendar day YYYY-MM-DD, read as a whole UTC day; both ends are inclusive.
// Date parsing rolls impossible values over (Feb 30 -> Mar 2), so check the parts survive
const CALENDAR_PARTS = /^(\d{4})-(\d{2})-(\d{2})/;
const CLOCK_PARTS = /T(\d{2}):(\d{2})(?::(\d{2}))?/;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

function isRealCalendarDate(text) {
  const [year, month, day] = text.match(CALENDAR_PARTS).slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isRealClockTime(text) {
  const [hours, minutes, seconds = 0] = text
    .match(CLOCK_PARTS)
    .slice(1)
    .map((part) => Number(part || 0));
  return hours < HOURS_PER_DAY && minutes < MINUTES_PER_HOUR && seconds < MINUTES_PER_HOUR;
}

function parseDateBound(value, endOfDay) {
  const text = String(value);
  if (DATE_TIME.test(text)) {
    const instant = new Date(text);
    const valid =
      !Number.isNaN(instant.getTime()) && isRealCalendarDate(text) && isRealClockTime(text);
    return valid ? instant : null;
  }
  if (!DATE_ONLY.test(text) || !isRealCalendarDate(text)) return null;
  return new Date(`${text}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`);
}

function parseDateRange(startDate, endDate) {
  if (!startDate && !endDate) return {};
  const range = {};
  if (startDate) {
    range.$gte = parseDateBound(startDate, false);
    if (!range.$gte)
      return { error: 'startDate must be a valid date (YYYY-MM-DD or ISO date-time).' };
  }
  if (endDate) {
    range.$lte = parseDateBound(endDate, true);
    if (!range.$lte)
      return { error: 'endDate must be a valid date (YYYY-MM-DD or ISO date-time).' };
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    return { error: 'startDate must be on or before endDate.' };
  }
  return { range };
}

function buildExperienceBreakdown(applications, roles) {
  const counts = Object.fromEntries(EXPERIENCE_CATEGORIES.map((c) => [c, 0]));
  let notReported = 0;

  applications.forEach((application) => {
    const profile = getApplicantProfile(application);
    const jobTitle = String(profile.jobTitle || '')
      .trim()
      .toLowerCase();
    if (roles.length && !roles.includes(jobTitle)) return;

    const years = toExperienceYears(profile.fullTimeYears);
    if (years === null) {
      notReported += 1;
      return;
    }
    counts[experienceCategory(years)] += 1;
  });

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const breakdown = total
    ? EXPERIENCE_CATEGORIES.map((experience) => ({
        experience,
        count: counts[experience],
        percentage: Number(((counts[experience] / total) * PERCENT).toFixed(1)),
      }))
    : [];
  return { breakdown, total, notReported };
}

const analyticsController = function (
  Applicant,
  AnonymousInteraction,
  AnonymousApplication,
  AnalyticsSummary,
  JobApplication,
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

  // Experience breakdown of real job applications, filterable by submission date and role
  const getExperienceBreakdown = async (req, res) => {
    try {
      // Check admin/owner permissions
      if (!canViewApplicantAnalytics(req.body.requestor)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { range, error } = parseDateRange(req.query.startDate, req.query.endDate);
      if (error) {
        return res.status(400).json({ error });
      }

      const roles = parseRoles(req.query.roles);
      if (!roles) {
        return res.status(400).json({ error: 'roles must be a list of job titles.' });
      }

      const query = range ? { submittedAt: range } : {};
      const applications = await JobApplication.find(query, PROFILE_PROJECTION).lean();

      return res.status(200).json(buildExperienceBreakdown(applications, roles));
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
      const requestor = req.body?.requestor;
      if (!requestor || !requestor.role) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (requestor.role !== 'Owner' && requestor.role !== 'Administrator') {
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
      const isDbError =
        error?.name === 'MongoError' ||
        error?.name === 'MongooseError' ||
        error?.code === 'ECONNREFUSED' ||
        error?.message?.includes('buffering') ||
        error?.message?.includes('MongoDB');
      if (isDbError) {
        return res.status(200).json(fallbackApplicantSources);
      }
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  // Job titles applicants applied for, for the experience chart's role filter
  const getAllRoles = async (req, res) => {
    try {
      if (!canViewApplicantAnalytics(req.body && req.body.requestor)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const applications = await JobApplication.find({}, PROFILE_PROJECTION).lean();
      const titles = new Map();
      applications.forEach((application) => {
        const title = String(getApplicantProfile(application).jobTitle || '').trim();
        if (title && !titles.has(title.toLowerCase())) titles.set(title.toLowerCase(), title);
      });
      const roles = [...titles.values()].sort((a, b) => a.localeCompare(b));
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
