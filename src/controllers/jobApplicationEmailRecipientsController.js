const UserProfile = require('../models/userProfile');
const JobApplicationEmailRecipients = require('../models/JobApplicationEmailRecipients');

const SETTINGS_KEY = 'jobApplicationNotifications';

// Verify the user's current role from the database, not from the request body.
async function canManageRecipients(req) {
  const userId = req.user?.requestorId;
  if (!userId) return false;

  const user = await UserProfile.findById(userId).select('role').lean();
  return user?.role === 'Owner' || user?.role === 'Administrator';
}

exports.getRecipients = async (req, res) => {
  try {
    if (!(await canManageRecipients(req))) {
      return res.status(403).json({
        message: 'Only Owners and Administrators can manage email recipients.',
      });
    }

    const settings = await JobApplicationEmailRecipients.findOne({
      settingsKey: SETTINGS_KEY,
    }).lean();

    return res.status(200).json({
      recipients: settings?.recipients || [],
    });
  } catch (error) {
    console.error('Error retrieving job application email recipients:', error);
    return res.status(500).json({
      message: 'Unable to retrieve email recipients.',
    });
  }
};

exports.updateRecipients = async (req, res) => {
  try {
    if (!(await canManageRecipients(req))) {
      return res.status(403).json({
        message: 'Only Owners and Administrators can manage email recipients.',
      });
    }

    const { recipients } = req.body;

    if (!Array.isArray(recipients) || !recipients.every((email) => typeof email === 'string')) {
      return res.status(400).json({
        message: 'Recipients must be an array of email addresses.',
      });
    }

    const normalizedRecipients = [
      ...new Set(recipients.map((email) => email.trim().toLowerCase())),
    ];

    // Reject consecutive dots and require valid domain labels.
    const emailPattern = /^(?!.*\.\.)[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

    if (normalizedRecipients.some((email) => !emailPattern.test(email))) {
      return res.status(400).json({
        message: 'One or more email addresses are invalid.',
      });
    }

    const settings = await JobApplicationEmailRecipients.findOneAndUpdate(
      { settingsKey: SETTINGS_KEY },
      {
        $set: {
          recipients: normalizedRecipients,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      message: 'Email recipients updated successfully.',
      recipients: settings.recipients,
    });
  } catch (error) {
    console.error('Error updating job application email recipients:', error);
    return res.status(500).json({
      message: 'Unable to update email recipients.',
    });
  }
};
