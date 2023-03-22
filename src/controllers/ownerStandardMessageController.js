const ownerStandardMessageController = function (OwnerStandardMessage) {
  const postOwnerStandardMessage = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to create messages!');
    }
    const ownerStandardMessage = new OwnerStandardMessage();
    ownerStandardMessage.message = req.body.newMessage;
    ownerStandardMessage.save().then(() => res.status(201).json({
      _serverMessage: 'Message succesfuly created!',
      ownerStandardMessage,
    })).catch(err => res.status(500).send({ err }));
  };

  const getOwnerStandardMessage = function (req, res) {
    OwnerStandardMessage.find()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const deleteOwnerStandardMessage = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to delete messages!');
    }
    OwnerStandardMessage.deleteMany({})
    .then((result) => {
      result
        .then(res.status(200).send({ _serverMessage: 'Message deleted!' }))
        .catch((error) => {
          res.status(400).send(error);
        });
    })
    .catch((error) => {
      res.status(400).send(error);
    });
  };

  const updateOwnerStandardMessage = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to update messages!');
    }
    const { id } = req.params;

    return OwnerStandardMessage.findById(id, (error, ownerStandardMessage) => {
      if (error || ownerStandardMessage === null) {
        res.status(400).send('No ownerMessage found');
        return;
      }

      ownerStandardMessage.message = req.body.newMessage;
      ownerStandardMessage.save()
        .then(results => res.status(201).send(results))
        .catch(errors => res.status(400).send(errors));
    });
  };

  return {
    postOwnerStandardMessage,
    getOwnerStandardMessage,
    deleteOwnerStandardMessage,
    updateOwnerStandardMessage,
  };
};

module.exports = ownerStandardMessageController;
