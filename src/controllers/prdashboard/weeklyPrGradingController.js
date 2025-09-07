const weeklyPrGradingController = function (PrGrading) {
  const getWeeklyPrGrading = async (req, res) => {
    const { team } = req.params;

    try {
      const gradingData = await PrGrading.find({ teamCode: team });
      res.status(200).json(gradingData);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const postWeeklyPrGrading = async (req, res) => {
    const gradingEntry = new PrGrading(req.body);
    try {
      const savedEntry = await gradingEntry.save();
      res.status(201).json(savedEntry);
    } catch (error) {
      res.status(400).json({ error: 'Bad request' });
    }
  };

  return { getWeeklyPrGrading, postWeeklyPrGrading };
};

module.exports = weeklyPrGradingController;
