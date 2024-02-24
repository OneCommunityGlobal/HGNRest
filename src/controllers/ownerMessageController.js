const hasPermission = require("../utilities/permissions");

const ownerMessageController = function (OwnerMessage) {
  const getOwnerMessage = async function (req, res) {
    try {
      const results = await OwnerMessage.find({});
      if (results.length === 0) { // first time initialization
        const ownerMessage = new OwnerMessage();
        await ownerMessage.save();
        res.status(200).send({ ownerMessage });
      } else {
        res.status(200).send({ ownerMessage: results[0] });
      }
    } catch (error) {
      res.status(404).send(error);
    }
  };

  const updateOwnerMessage = async function (req, res) {
    
    const canEditHeaderMessage = hasPermission(req.body.requestor, 'editHeaderMessage');
    
    if (!canEditHeaderMessage) {
      res.status(403).send('You are not authorized to create messages!');
    }
    const { isStandard, newMessage } = req.body;
    try {
      const results = await OwnerMessage.find({});
      const ownerMessage = results[0];
      if (isStandard) {
        ownerMessage.standardMessage = newMessage;
        ownerMessage.message = '';
      } else {
        ownerMessage.message = newMessage;
      }
      await ownerMessage.save();
      const { standardMessage, message } = ownerMessage;
      res.status(201).send({
        _serverMessage: 'Update successfully!',
        ownerMessage: { standardMessage, message },
      });
    } catch (error) {
      res.status(500).send(error);
    }
  };

  const deleteOwnerMessage = async function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to delete messages!');
    }
    try {
      const results = await OwnerMessage.find({});
      const ownerMessage = results[0];
      ownerMessage.message = '';
      await ownerMessage.save();
      res.status(200).send({ _serverMessage: 'Delete successfully!', ownerMessage });
    } catch (error) {
      res.status(500).send(error);
    }
  };

  return {
    getOwnerMessage,
    updateOwnerMessage,
    deleteOwnerMessage,
  };
};

module.exports = ownerMessageController;
