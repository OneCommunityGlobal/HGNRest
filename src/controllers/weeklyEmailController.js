const connectDB = require('../startup/db');
const userHelper = require('../helpers/userHelper')();

const weeklyEmailController = function () {
  const sendWeeklySummariesEmail = async function (req, res) {
    try {
      console.log(`[Weekly Email] Manual send triggered at ${new Date().toISOString()}`);

      // Respond immediately
      res.status(202).json({
        message: '🔄 Weekly summaries email started in background.',
        timestamp: new Date().toISOString(),
      });

      // Run the actual logic in the background
      setImmediate(async () => {
        try {
          await connectDB();

          console.log('[Weekly Email] sendEmail env var:', process.env.sendEmail);
          console.log('[Weekly Email] REACT_APP_EMAIL env var:', process.env.REACT_APP_EMAIL);

          await userHelper.emailWeeklySummariesForAllUsers();
          console.log('[Background] ✅ Weekly summaries email sent successfully.');
        } catch (err) {
          console.error('[Background] ❌ Error sending weekly summaries:', err);
        }
      });
    } catch (error) {
      console.error('[API Trigger] ❌ Immediate failure:', error);
      res.status(500).json({ error: '❌ Failed to initiate weekly summary email.' });
    }
  };

  return {
    sendWeeklySummariesEmail,
  };
};

module.exports = weeklyEmailController;
