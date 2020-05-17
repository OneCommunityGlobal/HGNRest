const timerController = function(Timer) {

  const putTimer = function (req, res) {
    const userId = req.params.userId;

    const query = { userId: userId };
    const update = { 
      $set: {
        pausedAt: req.body.pausedAt, 
        isWorking: req.body.isWorking
      }
    };
    const options = { upsert: true, new: true, setDefaultsOnInsert: true, rawResult:true };

    Timer.findOneAndUpdate(query, update, options, function(error, rawResult) {
      if (error) {
        return res.status(500).send({ error });
      } 
      
      if (rawResult === null || rawResult.value === undefined || rawResult.value === null ||
        rawResult.lastErrorObject === null || rawResult.lastErrorObject === undefined ||
        rawResult.value.length === 0) {
        return res.status(500).send("Update/Upsert timer date failed");
      }
      
      if (rawResult.lastErrorObject.updatedExisting === true) {
        return res.status(200).send({ message: 'updated timer data' });
      }
      else if (rawResult.lastErrorObject.updatedExisting === false && 
        rawResult.lastErrorObject.upserted !== undefined && rawResult.lastErrorObject.upserted !== null) {
        return res.status(201).send({ _id: rawResult.lastErrorObject.upserted });
      }
      return res.status(500).send("Update/Upsert timer date failed");
    });
  };

  const getTimer = function (req, res) {
    const userId = req.params.userId;

    Timer.findOne({ userId: userId }, function(error, record){
      if (error){
        return res.status(500).send(error);
      }
      if (record === null) {
        return res.status(400).send("Timer record not found for the given user ID")
      }

      return res.status(200).send(record);
    });
  }

  return { putTimer, getTimer };
};

module.exports = timerController;
