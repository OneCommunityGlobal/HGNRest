const connectDB = require('../startup/db');
const userHelper = require('../helpers/userHelper')();
const { hasPermission } = require('../utilities/permissions');

const BlueSquareEmailAssignmentController = function (BlueSquareEmailAssignment, userProfile) {
  const getBlueSquareEmailAssignment = async function (req, res) {
    try {
      const assignments = await BlueSquareEmailAssignment.find().populate('assignedTo').exec();
      res.status(200).send(assignments);
    } catch (error) {
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
      // Check permission
      if (!(await hasPermission(req.body.requestor, 'resendBlueSquareAndSummaryEmails'))) {
        res.status(403).send('You are not authorized to perform this action');
        return;
      }

      // Respond immediately
      res.status(202).json({ message: '🔄 Weekly summaries resend started in background.' });

      // Run the actual logic in the background
      setImmediate(async () => {
        try {
          await connectDB();
          await userHelper.emailWeeklySummariesForAllUsers();
        } catch (err) {
          console.error('[Background] ❌ Error sending weekly summaries:', err);
        }
      });
    } catch (error) {
      console.error('[API Trigger] ❌ Immediate failure:', error);
      res.status(500).json({ error: '❌ Failed to initiate weekly summary resend.' });
    }
  };

  const runManualBlueSquareEmailResend = async function (req, res) {
    try {
      // Check permission
      if (!(await hasPermission(req.body.requestor, 'resendBlueSquareAndSummaryEmails'))) {
        res.status(403).send('You are not authorized to perform this action');
        return;
      }

      console.log('[API Trigger] Manual blue square email resend');

      // Respond immediately
      res.status(202).json({ message: 'Blue square email resend started in background.' });

      // Run the actual email logic in background
      setImmediate(async () => {
        try {
          await userHelper.resendBlueSquareEmailsOnlyForLastWeek();
        } catch (err) {
          console.error('[Background] ❌ Error during blue square email resend:', err);
        }
      });
    } catch (error) {
      console.error('[API Trigger] ❌ Immediate handler failed:', error);
      res.status(500).json({ error: '❌ Failed to initiate blue square email resend.' });
    }
  };

  const escapeRegExp = (s = '') => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const assignCCEmail = async function assignCCEmail(req, res) {
    try {
      // Which user's profile are we adding the CC list item to?
      const targetUserId = req.params.userId;
      if (!targetUserId) {
        return res.status(400).json({ error: 'Missing target userId' });
      }

      // CC person details
      const { email: ccEmail, firstName, lastName, role } = req.body || {};
      if (!ccEmail || !firstName || !lastName) {
        return res.status(400).json({ error: 'ccEmail, firstName and lastName are required' });
      }

      // Find the CC person by email to populate assignedTo
      const ccUser = await userProfile.findOne(
        { email: { $regex: `^${escapeRegExp(ccEmail)}$`, $options: 'i' } },
        { _id: 1, email: 1, firstName: 1, lastName: 1, role: 1 },
      );

      if (!ccUser) {
        return res.status(404).json({ error: 'No user found with that CC email' });
      }

      // Prevent duplicate by email (case-insensitive)
      const alreadyHas = await userProfile.exists({
        _id: targetUserId,
        'infringementCCList.email': { $regex: `^${escapeRegExp(ccEmail)}$`, $options: 'i' },
      });

      if (alreadyHas) {
        const existing = await userProfile.findById(targetUserId).select('infringementCCList');
        return res.status(200).json({
          message: 'CC already present',
          infringementCCList: existing?.infringementCCList || [],
        });
      }

      // Push the new entry. If infringementCCList doesn't exist, Mongo will create it.
      const updated = await userProfile
        .findByIdAndUpdate(
          targetUserId,
          {
            $push: {
              infringementCCList: {
                email: ccUser.email, // normalize to the stored email
                firstName, // take from body as requested
                lastName, // take from body as requested
                role, // take from body as requested
                assignedTo: ccUser._id, // ObjectId reference
              },
            },
          },
          { new: true, runValidators: true },
        )
        .select('infringementCCList');

      if (!updated) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      return res.status(200).json({
        message: 'CC added',
        infringementCCList: updated.infringementCCList || [],
      });
    } catch (error) {
      console.error('assignCCEmail error:', error);
      return res.status(500).json({ error: 'Failed to assign CC email', details: error.message });
    }
  };

  const removeCCEmail = async function removeCCEmail(req, res) {
    try {
      // Which user's profile are we removing the CC list item from?
      const targetUserId = req.params.userId;
      const ccEmail = req.params.email;

      if (!targetUserId) {
        return res.status(400).json({ error: 'Missing target userId' });
      }

      // CC person email to remove
      if (!ccEmail) {
        return res.status(400).json({ error: 'ccEmail is required' });
      }

      // Check if this CC email exists in the list
      const userProfileDoc = await userProfile
        .findOne({
          _id: targetUserId,
          'infringementCCList.email': {
            $regex: `^${escapeRegExp(ccEmail)}$`,
            $options: 'i',
          },
        })
        .select('infringementCCList');

      if (!userProfileDoc) {
        return res.status(404).json({
          error: 'No matching CC email found for this user',
        });
      }

      // Perform the removal
      const updated = await userProfile
        .findByIdAndUpdate(
          targetUserId,
          {
            $pull: {
              infringementCCList: {
                email: { $regex: `^${escapeRegExp(ccEmail)}$`, $options: 'i' },
              },
            },
          },
          { new: true },
        )
        .select('infringementCCList');

      if (!updated) {
        return res.status(404).json({ error: 'Target user not found after update' });
      }

      return res.status(200).json({
        message: 'CC email removed successfully',
        infringementCCList: updated.infringementCCList || [],
      });
    } catch (error) {
      console.error('removeCCEmail error:', error);
      return res.status(500).json({
        error: 'Failed to remove CC email',
        details: error.message,
      });
    }
  };

  return {
    getBlueSquareEmailAssignment,
    setBlueSquareEmailAssignment,
    deleteBlueSquareEmailAssignment,
    runManuallyResendWeeklySummaries,
    runManualBlueSquareEmailResend,
    assignCCEmail,
    removeCCEmail,
  };
};

module.exports = BlueSquareEmailAssignmentController;
