const connectDB = require('../startup/db');
const userHelper = require('../helpers/userHelper')();

const BlueSquareEmailAssignmentController = function (BlueSquareEmailAssignment, userProfile) {
  const getBlueSquareEmailAssignment = async function (req, res) {
    try {
      const assignments = await BlueSquareEmailAssignment.find().populate('assignedTo').exec();
      res.status(200).send(assignments);
    } catch (error) {
      console.log(error);
      res.status(500).send(error);
    }
  };

  const setBlueSquareEmailAssignment = async function (req, res) {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).send('bad request');
        return;
      }

      const user = await userProfile.findOne({ email });
      if (!userProfile) {
        return res.status(400).send('User profile not found');
      }

      const newAssignment = new BlueSquareEmailAssignment({
        email,
        assignedTo: user._id,
      });
      await newAssignment.save();
      const assignment = await BlueSquareEmailAssignment.find({ email })
        .populate('assignedTo')
        .exec();

      res.status(200).send(assignment[0]);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const deleteBlueSquareEmailAssignment = async function (req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).send('bad request');
        return;
      }

      const deletedAssignment = await BlueSquareEmailAssignment.findOneAndDelete({ _id: id });
      if (!deletedAssignment) {
        res.status(404).send('Assignment not found');
        return;
      }

      res.status(200).send({ id });
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const runManuallyResendWeeklySummaries = async function (req, res) {
    try {
      console.log(`[Manual Resend] Triggered at ${new Date().toISOString()}`);

      // Respond immediately
      res.status(202).json({ message: '🔄 Weekly summaries resend started in background.' });

      // Run the actual logic in the background
      setImmediate(async () => {
        try {
          await connectDB();
          await userHelper.emailWeeklySummariesForAllUsers();
          console.log('[Background] ✅ Weekly summaries resent.');
        } catch (err) {
          console.error('[Background] ❌ Error sending weekly summaries:', err);
        }
      });
    } catch (error) {
      console.error('[API Trigger] ❌ Immediate failure:', error);
      res.status(500).json({ error: '❌ Failed to initiate weekly summary resend.' });
    }
  };

  const testWeeklySummariesEmail = async function (req, res) {
    try {
      console.log(`[Test Email] Triggered at ${new Date().toISOString()}`);

      // Respond immediately
      res.status(202).json({ message: '🔄 Test weekly summaries email started in background.' });

      // Run the actual logic in the background
      setImmediate(async () => {
        try {
          await connectDB();

          // Check if sendEmail environment variable is set
          console.log('[Test] sendEmail env var:', process.env.sendEmail);
          console.log('[Test] REACT_APP_EMAIL env var:', process.env.REACT_APP_EMAIL);

          await userHelper.emailWeeklySummariesForAllUsers();
          console.log('[Background] ✅ Test weekly summaries email sent.');
        } catch (err) {
          console.error('[Background] ❌ Error sending test weekly summaries:', err);
        }
      });
    } catch (error) {
      console.error('[API Trigger] ❌ Immediate failure:', error);
      res.status(500).json({ error: '❌ Failed to initiate test weekly summary email.' });
    }
  };

  const runManualBlueSquareEmailResend = async function (req, res) {
    try {
      console.log('[API Trigger] Manual blue square email resend');

      // Respond immediately
      res.status(202).json({ message: 'Blue square email resend started in background.' });

      // Run the actual email logic in background
      setImmediate(async () => {
        try {
          await userHelper.resendBlueSquareEmailsOnlyForLastWeek();
          console.log('[Background] ✅ Blue square emails resent without reassigning.');
        } catch (err) {
          console.error('[Background] ❌ Error during blue square email resend:', err);
        }
      });
    } catch (error) {
      console.error('[API Trigger] ❌ Immediate handler failed:', error);
      res.status(500).json({ error: '❌ Failed to initiate blue square email resend.' });
    }
  };

  return {
    getBlueSquareEmailAssignment,
    setBlueSquareEmailAssignment,
    deleteBlueSquareEmailAssignment,
    runManuallyResendWeeklySummaries,
    testWeeklySummariesEmail,
    runManualBlueSquareEmailResend,
  };
};

module.exports = BlueSquareEmailAssignmentController;
