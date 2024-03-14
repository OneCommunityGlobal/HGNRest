const mongoose = require('mongoose');

const bmToolController = (BuildingTool) => {
    const fetchSingleTool = async (req, res) => {
        const { toolId } = req.params;
        try {
            BuildingTool
                .findById(toolId)
                .populate([
                    {
                        path: 'itemType',
                        select: '_id name description unit imageUrl category',
                    },
                    {
                        path: 'project',
                        select: 'name',
                    },
                    {
                        path: 'userResponsible',
                        select: '_id firstName lastName',
                    },
                    {
                        path: 'purchaseRecord',
                        populate: {
                            path: 'requestedBy',
                            select: '_id firstName lastName',
                        },
                    },
                    {
                        path: 'updateRecord',
                        populate: {
                            path: 'createdBy',
                            select: '_id firstName lastName',
                        },
                    },
                    {
                        path: 'logRecord',
                        populate: [{
                            path: 'createdBy',
                            select: '_id firstName lastName',
                        },
                        {
                            path: 'responsibleUser',
                            select: '_id firstName lastName',
                    }],
                    },
                ])
                .exec()
                .then(tool => res.status(200).send(tool))
                .catch(error => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
     };

    const bmPurchaseTools = async function (req, res) {
        const {
          projectId,
          toolId,
          quantity,
          priority,
          estTime: estUsageTime,
          desc: usageDesc,
          makeModel: makeModelPref,
          requestor: { requestorId },
        } = req.body;
        try {
            const newPurchaseRecord = {
                quantity,
                priority,
                estUsageTime,
                usageDesc,
                makeModelPref,
                requestedBy: requestorId,
              };
          const doc = await BuildingTool.findOne({ project: projectId, itemType: toolId });
          if (!doc) {
            const newDoc = {
              itemType: toolId,
              project: projectId,
              purchaseRecord: [newPurchaseRecord],
            };

            BuildingTool
              .create(newDoc)
              .then(() => res.status(201).send())
              .catch(error => res.status(500).send(error));
              return;
          }

            BuildingTool
              .findOneAndUpdate(
                { _id: mongoose.Types.ObjectId(doc._id) },
                { $push: { purchaseRecord: newPurchaseRecord } },
              )
              .exec()
              .then(() => res.status(201).send())
              .catch(error => res.status(500).send(error));
        } catch (error) {
          res.status(500).send(error);
        }
      };

      const bmLogTools = async function (req, res) {
        console.log("*******************************************")
        console.log("bmLogTools in bmToolController called");
        console.log("requestorId: ", req.body.requestor.requestorId);

        const {toolId, date, project, check} = req.body; 
        const requestor = req.body.requestor.requestorId;
        console.log("toolId: ",toolId, ", date: ", date, ", project: ", project, ', check: ', check);

     

        // logRecord: [{ // track tool daily check in/out and responsible user
        //   date: { type: Date, default: Date.now() },
        //   createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
        //   responsibleUser: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
        //   type: { type: String, enum: ['Check In', 'Check Out'] },
        // let doc = await BuildingTool.findOne({ _id:  toolId});
    
        try {
          const document = await BuildingTool.findOne({ _id: toolId })

          if(document){
            // console.log("document: ", document)
            const {available, using, userResponsible} = document;
            const newLogRecord = {
              date: date,
              createdBy: requestor,
              responsibleUser: userResponsible, 
              type: check,
            };
            
            console.log("available: ", available, ", using: ", using, ", userResponsible: ", userResponsible, ", newLogRecord: ", newLogRecord);
            document.logRecord.push(newLogRecord)
            console.log("document.logRecord: ", document.logRecord);

            await document.save();
            res.status(200).send('Tool log record added successfully.');
          }else{
            res.status(404).send('Tool with this id was not found.');
          }

          // BuildingTool
          //       .findOneAndUpdate(
          //         { _id: mongoose.Types.ObjectId(toolId) },
          //         { $push: { logRecord: newLogRecord } },
          //       )
          //       .exec()
          //       .then(() => res.status(201).send("Saved"))
          //       .catch(error => res.status(500).send(error));
        }catch(error){
          console.log("error: ", error); //delete later
          res.status(500).send(error);
        }

        // res.status(200).send("Thanks");
      }

      return {
        fetchSingleTool,
        bmPurchaseTools,
        bmLogTools
      };
};

module.exports = bmToolController;
