const express = require("express");

const route = (ReasonModel, UserModel) => {
  const reasonRouter = express.Router();

  //post a reason to be scheduled
  reasonRouter.post("/reason/", async (req, res) => {
    try {
      const { userId, requestor, reasonData } = req.body;
      if(moment(reasonData.date).day() !== 0){
        return res.status(400).json({
            message: 'The selected day must be a sunday so the code can work properly',
            errorCode: 0
        })
      }
      if (requestor.role !== "Owner" || requestor.role !== "Administrator") {
        return res.status(403).json({
          message:
            "You must be an Owner or Administrator to schedule a reason for a Blue Square",
          errorCode: 1,
        });
      }
      const foundUser = await UserModel.findById(userId);
      if (!foundUser) {
        return res.status(404).json({
          message: "User not found",
          errorCode: 2,
        });
      }

      const foundReason = await ReasonModel.find({
        date: reasonData.date,
      });

      if (foundReason.length !== 0) {
        return res.status(403).json({
          message: "The reason must be unique to the date",
          errorCode: 3,
        });
      }

      const newReason = new ReasonModel({
        reason: reasonData.reason,
        date: reasonData.date,
        userId: foundUser.userId,
      });
      await newReason.save();
      return res.sendStatus(200);
    } catch (error) {
      return res.status(400).json({
        errMessage: "Something went wrong",
      });
    }
  });

  //retrieve all user's reasons
  reasonRouter.get("/reason/:id", async (req, res) => {
    try {
      const { requestor } = req.body;
      const userId = req.params.id;

      if (requestor.role !== "Owner" || requestor.role !== "Administrator") {
        return res.status(403).json({
          message:
            "You must be an Owner or Administrator to get a reason for a Blue Square",
        });
      }
      const foundUser = await UserModel.findById(userId);
      if (!foundUser) {
        return res.status(404).json({
          message: "User not found",
        });
      }
      const reasons = await ReasonModel.find({
        userId: foundUser.userId,
      });
      return res.status(200).json({
        reasons,
      });
    } catch (error) {
      return res.status(400).json({
        errMessage: "Something went wrong while fetching the user",
      });
    }
  });

  //get user reason by date
  reasonRouter.get('/reason/single/:id', async (req, res) => {
    
  })

};

module.exports = route;
