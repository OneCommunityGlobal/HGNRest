const Users = require('../../models/lbdashboard/users');
// const BidNotifications = require('../../models/lbdashboard/bidnotifications');

const bidNotificationsController = function (BidNotifications) {
  const postBidNotificationsloc = async (req) => {
    try {
      const { message, email } = req.body;
 
      const userExists = await Users.findOne({ email });
      if (!userExists) {
        return { status: 400, error: 'Invalid email' };
      }
      const newBidNotificationsData = { ...req.body, userId: userExists._id };
      const newBidNotifications = new BidNotifications(newBidNotificationsData);
      const savedBidNotifications = await newBidNotifications.save();
      return { status: 200, data: savedBidNotifications };
    } catch (error) {
      return { status: 500, error: error.response?.data?.error || error.message || 'Unknown error' };
    }
  };

  const postBidNotifications = async (req, res) => {
    try {
      const savedBidNotifications = await postBidNotificationsloc(req);
      if (savedBidNotifications.status !== 200)
        return res.status(500).json({ success: false, error: savedBidNotifications.error || 'Unknown Error' });
      res.status(200).json({ success: true, data: savedBidNotifications.data });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  const getBidNotifications = async (req, res) => {
    const { email } = req.body;
    try {
      const users = await Users.findOne({ email });
      
      if (!users) {
        return res.status(400).json({ success: false, error:"Invalid Email"});
      }
      const results = await BidNotifications.find({ userId: users._id, isDelivered: false })

        .select('userId message isDelivered createdAt modifiedAt _id');
          return res.status(200).json({ success: true, data:results});
      } 
        catch(error)  {
          return res.status(500).json({success:false, error: error.response?.data?.error || error.message || 'Unknown error'} );
    }
    
  };

  const bidNotificationsMarkDelivered = async (req, res) => {
    const { notificationIds } = req.body;
    try {
      const postBidNotificationsMarkDelivered = await BidNotifications.updateMany(
        { _id: { $in: notificationIds } },
        { $set: { isDelivered: true } },
      );

      res.status(200).json({ success: true, data:           {
    matchedCount: postBidNotificationsMarkDelivered.n,
    modifiedCount: postBidNotificationsMarkDelivered.nModified,
    }
    
    }); 
  }
    catch (error) {
      res.status(500).json({success:false, error : error.response?.data?.error || error.message || 'Unknown error' });
    }
  };
  return {
    getBidNotifications,
    postBidNotifications,
    bidNotificationsMarkDelivered,
  };
};
module.exports = bidNotificationsController;
