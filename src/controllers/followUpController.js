const followUpController = function (followUp) {
  const getFollowups = async function (req, res) {
    try {
      const result = await followUp.aggregate([
        {
          $group: {
            _id: '$userId',
            entries: { $push: '$$ROOT' },
          },
        },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            entries: 1,
          },
        },
      ]);

      const formattedResult = {};
      result.forEach((item) => {
        formattedResult[item.userId.toString()] = item.entries;
      });
      res.status(200).send(formattedResult);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const setFollowUp = async function (req, res) {
    try {
      const userId = req.params.userId;
      const taskId = req.params.taskId;

      const updateData = req.body;

      if (typeof updateData.followUpCheck !== 'boolean'
        || (!updateData.followUpPercentageDeadline
        && updateData.followUpPercentageDeadline !== 0)) {
        res.status(400).send('bad request');
        return;
      }
      const updatedFollowUp = await followUp.findOneAndUpdate(
        { userId, taskId },
        updateData,
        { new: true, upsert: true },
        );

      res.status(200).send(updatedFollowUp);
    } catch (error) {
      res.status(500).send(error);
    }
  };

  return {
    getFollowups,
    setFollowUp,
  };
};

module.exports = followUpController;
