const ownerMessageController = function (OwnerMessage) {
  const postOwnerMessage = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to create messages!');
    }
    const ownerMessage = new OwnerMessage();
    ownerMessage.message = req.body.newMessage;
    ownerMessage.save().then(() => res.status(201).json({
      _serverMessage: 'Message succesfuly created!',
      ownerMessage,
    })).catch(err => res.status(500).send({ err }));
  };

  const getOwnerMessage = function (req, res) {
    OwnerMessage.find()
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const deleteOwnerMessage = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to delete messages!');
    }
    OwnerMessage.deleteMany({})
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

  const updateOwnerMessage = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to update messages!');
    }
    const { id } = req.params;

    return OwnerMessage.findById(id, (error, ownerMessage) => {
      if (error || ownerMessage === null) {
        res.status(400).send('No ownerMessage found');
        return;
      }

      ownerMessage.message = req.body.newMessage;
      ownerMessage.save()
        .then(results => res.status(201).send(results))
        .catch(errors => res.status(400).send(errors));
    });
  };

  return {
    postOwnerMessage,
    getOwnerMessage,
    deleteOwnerMessage,
    updateOwnerMessage,
  };
};

module.exports = ownerMessageController;
