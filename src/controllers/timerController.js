const timerController = function (Timer) {
  const putTimer = function (req, res) {
    const { userId } = req.params;

    const query = { userId };
    const update = {
      $set: {
        pausedAt: req.body.pausedAt,
        isWorking: req.body.isWorking,
        started: req.body.isWorking ? Date.now() : null,
        lastAccess: Date.now(),
      },
    };
    const options = {
      upsert: true, new: true, setDefaultsOnInsert: true, rawResult: true,
    };

    Timer.findOneAndUpdate(query, update, options, (error, rawResult) => {
      if (error) {
        return res.status(500).send({ error });
      }

      if (rawResult === null || rawResult.value === undefined || rawResult.value === null
        || rawResult.lastErrorObject === null || rawResult.lastErrorObject === undefined
        || rawResult.value.length === 0) {
        return res.status(500).send('Update/Upsert timer date failed');
      }

      if (rawResult.lastErrorObject.updatedExisting === true) {
        return res.status(200).send({ message: 'updated timer data' });
      }
      if (rawResult.lastErrorObject.updatedExisting === false
        && rawResult.lastErrorObject.upserted !== undefined && rawResult.lastErrorObject.upserted !== null) {
        return res.status(201).send({ _id: rawResult.lastErrorObject.upserted });
      }
      return res.status(500).send('Update/Upsert timer date failed');
    });
  };

  const timePassed = (timer) => {
    if (!timer.started) { return 0; }
    const now = timer.timedOut ? timer.lastAccess : Date.now();
    return Math.floor((now - timer.started) / 1000);
  };

  const adjust = (timer, cb) => {
    const oneMin = 60 * 1000;
    const fiveMin = 5 * oneMin;
    const timeSinceLastAccess = timer.lastAccess ? (Date.now() - timer.lastAccess) : 0;
    const setLastAccess = !timer.lastAccess || (timeSinceLastAccess > oneMin);

    timer.timedOut = timer.isWorking && (timeSinceLastAccess > fiveMin);
    timer.seconds = timer.pausedAt + timePassed(timer);

    if (timer.timedOut) {
      return Timer.findOneAndUpdate({ userId: timer.userId }, {
        isWorking: false,
        pauseAt: timer.seconds,
        started: null,
        lastAccess: Date.now(),
      }).then(() => cb(timer));
    } if (setLastAccess) {
      return Timer.findOneAndUpdate({ userId: timer.userId }, { lastAccess: Date.now() }).then(() => cb(timer));
    }

    cb(timer);
  };

  const getTimer = function (req, res) {
    const { userId } = req.params;

    Timer.findOne({ userId }).lean().exec((error, record) => {
      if (error) {
        return res.status(500).send(error);
      }
      if (record === null) {
        if (req.body.requestor.requestorId === userId) {
          const newRecord = {
            userId,
            pausedAt: 0,
            isWorking: false,
          };
          return Timer.create(newRecord).then(result => res.status(200).send(result)).catch(() => res.status(400).send('Timer record not found for the given user ID'));
        }
        return res.status(400).send('Timer record not found for the given user ID');
      }
      adjust(record, (timer) => { res.status(200).send(timer)});
    });
  };

  return { putTimer, getTimer };
};

module.exports = timerController;
