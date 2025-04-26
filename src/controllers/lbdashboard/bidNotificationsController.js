const Users = require('../../models/lbdashboard/users');
const BidNotifications = require('../../models/lbdashboard/bidnotifications');

const bidNotificationsController = function (BidNotifications) {
  // validations
  // 1. userId not null  ensures email & name not null
  // 2. message Not null done

  const postBidNotificationsloc = async (req) => {
    try {
      const { message, email } = req.body;

      console.log(req.body);

      const userExists = await Users.findOne({ email });
      if (!userExists) {
        return { status: 400, error: 'Invalid email' };
      }
      console.log(userExists);

      const newBidNotificationsData = { ...req.body, userId: userExists._id };
      const newBidNotifications = new BidNotifications(newBidNotificationsData);
      console.log('newBidNotifications');

      console.log(newBidNotifications);

      const savedBidNotifications = await newBidNotifications.save();
      console.log('savedBidNotifications');
      console.log(savedBidNotifications);
      return { status: 200, data: savedBidNotifications };
    } catch (error) {
      return { status: 500, error: error.message };
    }
  };

  const postBidNotifications = async (req, res) => {
    console.log('postBidNotifications');
    try {
      const savedBidNotifications = await postBidNotificationsloc(req);
      console.log(savedBidNotifications);
      if (savedBidNotifications.status !== 200)
        res.status(500).json({ success: false, error: error.message });
      // console.log(savedNotifications);
      res.status(200).json({ success: true, data: savedBidNotifications });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  const getBidNotifications = async (req, res) => {
    console.log('getBidNotifications');
    const { email } = req.body;

    console.log(req.body);

    try {
      console.log('inside getBidNotifications');
      BidNotifications.findOne({ email })
        .select('userId message isDelivered createdAt modifiedAt _id')
        .then((results) => {
          console.log('results fetched ');
          res.status(200).send(results);
        })
        .catch((error) => {
          console.log('error');
          res.status(500).send({ error });
        });
    } catch (error) {
      console.log('error occurred');
    }
  };
  return {
    getBidNotifications,
    postBidNotifications,
  };
};
module.exports = bidNotificationsController;
