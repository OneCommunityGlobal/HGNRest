const InjuryOverTime = require('../../models/bmdashboard/buildingInjuryOverTime');

exports.getInjuryOverTime = async (_req, res) => {
  try {
    const severities = await InjuryOverTime.distinct('severity');
    res.status(200).json(severities.filter(Boolean).sort());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
