const { hasPermission } = require('../utilities/permissions');
const Settings = require('../models/weeklyOrgSummarySettings');
const service = require('../services/weeklyOrgSummary/weeklyOrgSummaryService');
const { validateSettings } = require('../services/weeklyOrgSummary/schedule');

const SETTINGS_FIELDS = ['enabled', 'dayOfWeek', 'hour', 'minute', 'timezone', 'alertRecipients'];
const PERMISSION = 'putUserProfileImportantInfo';

const weeklyOrgSummaryController = () => {
  const ensureAllowed = async (req, res) => {
    if (await hasPermission(req.body.requestor, PERMISSION)) return true;
    res.status(403).send({ error: 'You are not authorized to manage the Total Org Summary email.' });
    return false;
  };

  const getStatus = async (req, res) => {
    try {
      if (!(await ensureAllowed(req, res))) return undefined;
      return res.status(200).send(await service.getStatus());
    } catch (err) {
      return res.status(500).send({ error: 'Could not load Total Org Summary email status.' });
    }
  };

  const updateSettings = async (req, res) => {
    try {
      if (!(await ensureAllowed(req, res))) return undefined;
      const update = {};
      SETTINGS_FIELDS.forEach((field) => {
        if (req.body[field] !== undefined) update[field] = req.body[field];
      });
      const errors = validateSettings(update);
      if (errors.length) return res.status(400).send({ errors });

      await Settings.findOneAndUpdate(
        { key: 'default' },
        { $set: { ...update, updatedBy: req.body.requestor.requestorId, updatedAt: new Date() } },
        { upsert: true, new: true },
      );
      return res.status(200).send(await service.getStatus());
    } catch (err) {
      return res.status(500).send({ error: 'Could not save Total Org Summary email settings.' });
    }
  };

  // Goes through the same weekly claim as the schedule, so it can never double-send.
  const sendNow = async (req, res) => {
    try {
      if (!(await ensureAllowed(req, res))) return undefined;
      const result = await service.runWeeklyOrgSummary({ trigger: 'manual' });
      const code = result.status === 'failed' ? 500 : 200;
      return res.status(code).send(result);
    } catch (err) {
      return res.status(500).send({ error: 'Could not start the Total Org Summary email.' });
    }
  };

  return { getStatus, updateSettings, sendNow };
};

module.exports = weeklyOrgSummaryController;
