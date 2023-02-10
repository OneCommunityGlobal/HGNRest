
const ownerMessageController = function (OwnerMessage) {
  const postOwnerMessage = function (req, res) {
    const ownerMessage = new OwnerMessage();
    ownerMessage.message = req.body.newMessage;

    ownerMessage.save().then(results => res.status(201).send(results)).catch(err => res.status(500).send({ err }));
  };


  return {
    postOwnerMessage,
  };
};

module.exports = ownerMessageController;
