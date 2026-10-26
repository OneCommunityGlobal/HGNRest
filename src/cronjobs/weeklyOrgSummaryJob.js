const cron = require('node-cron');
const { runIfDue } = require('../services/weeklyOrgSummary/weeklyOrgSummaryService');

let running = false;

// Ticks every 15 minutes. The schedule itself (day, time, timezone, on/off) lives in the
// database, so admin changes apply on the next tick with no restart. The run is claimed
// atomically per week, so extra ticks and other server instances never send twice.
const startWeeklyOrgSummaryJob = () =>
  cron.schedule('*/15 * * * *', async () => {
    if (running) return;
    running = true;
    try {
      await runIfDue();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Weekly Total Org Summary tick failed:', err);
    } finally {
      running = false;
    }
  });

module.exports = { startWeeklyOrgSummaryJob };
