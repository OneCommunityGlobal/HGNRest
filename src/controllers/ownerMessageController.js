const ownerMessageController = function (OwnerMessage) {
  const postOwnerMessage = function (req, res) {
    const ownerMessage = new OwnerMessage();
    ownerMessage.message = req.body.newMessage;
    ownerMessage.save().then(() => res.status(201).json({
      _serverMessage: 'Message succesfuly created!',
      ownerMessage,
    })).catch(err => res.status(500).send({ err }));
  };

  const getOwnerMessage = function (req, res) {
    OwnerMessage.find()
      .sort({ message: 1 })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const deleteOwnerMessage = function (req, res) {
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


  return {
    postOwnerMessage,
    getOwnerMessage,
    deleteOwnerMessage,
  };
};

module.exports = ownerMessageController;
