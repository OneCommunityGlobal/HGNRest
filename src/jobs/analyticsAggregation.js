const cron = require('node-cron');
const AnonymousInteraction = require('../models/anonymousInteraction');
const AnonymousApplication = require('../models/anonymousApplication');
const AnalyticsSummary = require('../models/analyticsSummary');

// Aggregate data for a specific date
const aggregateDailyData = async (date) => {
  try {
    const targetDate = new Date(date);
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23,
      59,
      59,
      999,
    );

    // Aggregate interactions for this day
    const interactionData = await AnonymousInteraction.aggregate([
      { $match: { timestamp: { $gte: startOfDay, $lte: endOfDay } } },
      {
        $group: {
          _id: null,
          totalInteractions: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' },
          avgSessionDuration: { $avg: '$sessionDuration' },
          deviceTypes: { $push: '$deviceType' },
          origins: { $push: '$origin' },
          interactionTypes: { $push: '$interactionType' },
          countries: { $push: '$location.country' },
          states: { $push: '$location.state' },
        },
      },
    ]);

    // Aggregate applications for this day
    const applicationData = await AnonymousApplication.aggregate([
      { $match: { submittedAt: { $gte: startOfDay, $lte: endOfDay } } },
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          avgConversionTime: { $avg: '$conversionTime' },
          avgInteractionsBeforeApp: { $avg: '$interactionsBeforeApplication' },
          applicationSources: { $push: '$applicationSource' },
          topJobs: {
            $push: {
              jobId: '$jobId',
              jobTitle: '$jobTitle',
            },
          },
        },
      },
    ]);

    const interactions = interactionData[0] || {};
    const applications = applicationData[0] || {};

    // Helper function to count occurrences
    const countOccurrences = (arr) => {
      const counts = {};
      arr?.forEach((item) => {
        counts[item] = (counts[item] || 0) + 1;
      });
      return counts;
    };

    // Helper function to get top N items with percentages
    const getTopItems = (arr, limit = 5) => {
      const counts = countOccurrences(arr);
      const total = arr?.length || 0;
      return Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([item, count]) => ({
          [item === 'null' || item === 'undefined' ? 'Unknown' : item]: item,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }));
    };

    // Calculate conversion rate
    const uniqueSessionsCount = interactions.uniqueSessions?.length || 0;
    const totalApplications = applications.totalApplications || 0;
    const conversionRate =
      uniqueSessionsCount > 0 ? Math.round((totalApplications / uniqueSessionsCount) * 100) : 0;

    // Build comprehensive metrics object
    const metrics = {
      totalInteractions: interactions.totalInteractions || 0,
      uniqueSessions: uniqueSessionsCount,
      applicationSubmissions: totalApplications,
      conversionRate,
      averageSessionDuration: Math.round(interactions.avgSessionDuration || 0),

      topCountries: getTopItems(interactions.countries, 10),
      topStates: getTopItems(interactions.states, 10),

      deviceBreakdown: {
        mobile: countOccurrences(interactions.deviceTypes)?.mobile || 0,
        desktop: countOccurrences(interactions.deviceTypes)?.desktop || 0,
        tablet: countOccurrences(interactions.deviceTypes)?.tablet || 0,
      },

      originBreakdown: {
        direct: countOccurrences(interactions.origins)?.direct || 0,
        search: countOccurrences(interactions.origins)?.search || 0,
        social: countOccurrences(interactions.origins)?.social || 0,
        referral: countOccurrences(interactions.origins)?.referral || 0,
        email: countOccurrences(interactions.origins)?.email || 0,
        other: countOccurrences(interactions.origins)?.other || 0,
      },

      interactionBreakdown: {
        page_view: countOccurrences(interactions.interactionTypes)?.page_view || 0,
        job_view: countOccurrences(interactions.interactionTypes)?.job_view || 0,
        job_search: countOccurrences(interactions.interactionTypes)?.job_search || 0,
        ad_click: countOccurrences(interactions.interactionTypes)?.ad_click || 0,
        download: countOccurrences(interactions.interactionTypes)?.download || 0,
        video_play: countOccurrences(interactions.interactionTypes)?.video_play || 0,
        social_share: countOccurrences(interactions.interactionTypes)?.social_share || 0,
        email_signup: countOccurrences(interactions.interactionTypes)?.email_signup || 0,
        contact_form: countOccurrences(interactions.interactionTypes)?.contact_form || 0,
        filter_use: countOccurrences(interactions.interactionTypes)?.filter_use || 0,
      },

      topJobViews: getTopItems(
        applications.topJobs?.map((job) => `${job.jobId}:${job.jobTitle}`),
        10,
      ).map((item) => {
        const [jobId, jobTitle] = Object.keys(item)[0].split(':');
        return {
          jobId,
          jobTitle,
          views: item.count,
          applications: applications.totalApplications || 0,
          conversionRate:
            item.count > 0 ? Math.round((applications.totalApplications / item.count) * 100) : 0,
        };
      }),
    };

    return metrics;
  } catch (error) {
    console.error('Error aggregating daily data:', error);
    throw error;
  }
};

// Generate summary for a specific date
const generateDailySummary = async (date) => {
  try {
    const targetDate = new Date(date);

    // Check if summary already exists for this date
    // Create separate date objects to avoid modifying targetDate
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23,
      59,
      59,
      999,
    );

    const existingSummary = await AnalyticsSummary.findOne({
      date: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
      summaryType: 'daily',
    });

    if (existingSummary) {
      // Update existing summary
      const metrics = await aggregateDailyData(targetDate);
      existingSummary.metrics = metrics;
      existingSummary.updatedAt = new Date();
      await existingSummary.save();

      return existingSummary;
    }

    // Create new summary
    const metrics = await aggregateDailyData(targetDate);

    const newSummary = new AnalyticsSummary({
      date: targetDate,
      summaryType: 'daily',
      metrics,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await newSummary.save();
    return newSummary;
  } catch (error) {
    console.error('Error generating daily summary:', error);
    throw error;
  }
};

// Cron job: Run daily at 1 AM
const scheduleDaily = () => {
  cron.schedule(
    '0 1 * * *',
    async () => {
      try {
        // Aggregate yesterday's data
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        await generateDailySummary(yesterday);
      } catch (error) {
        console.error('❌ Daily analytics aggregation failed:', error);
      }
    },
    {
      timezone: 'America/Los_Angeles',
    },
  );
};

// Manual function to backfill historical data
const backfillSummaries = async (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const summariesGenerated = [];

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const summary = await generateDailySummary(new Date(date));
      summariesGenerated.push(summary);
    } catch (error) {
      console.error(`Failed to generate summary for ${date.toDateString()}:`, error);
    }
  }
  return summariesGenerated;
};

module.exports = {
  scheduleDaily,
  generateDailySummary,
  backfillSummaries,
  aggregateDailyData,
};
