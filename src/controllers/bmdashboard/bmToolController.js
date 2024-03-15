const mongoose = require('mongoose');

const bmToolController = (BuildingTool, ToolType) => {
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
        //TODO: add loops to accept an array of toolItem id's
        //logically this should accept a type id too, I await the currentToolType early on,
        //the loop through array of tools added and perform the function below. 
        //might have to declare a new available and used constants to keep track of shit outside of the loop and update the tool type after to loop exits
        //this is going to be a pretty slow function...
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
            // console.log("document.itemType: ", document.itemType)
            const {userResponsible, itemType} = document;
            const currentToolType = await ToolType.findOne({ _id: document.itemType }) 
            // console.log("currentToolType: ", currentToolType)

            const newLogRecord = {
              date: date,
              createdBy: requestor,
              responsibleUser: userResponsible, 
              type: check,
            };
            
            // console.log("available: ", available, ", using: ", using, ", userResponsible: ", userResponsible, ", newLogRecord: ", newLogRecord);
            document.logRecord.push(newLogRecord);
            if(check === "Check Out"){
              console.log("Check Out: ", check);
              if(currentToolType.available > 0){
                // console.log("currentToolType.available > 0: ", currentToolType.available);
                currentToolType.available --;
                currentToolType.using++;
              }else{
                // console.log("currentToolType.available <= 0: ", currentToolType.available);
                return res.status(400).send(`Can not process request "${check}". ${currentToolType.name} stock exceeded`);//TODO: convert to {message: ''} 
              }
            }else if(check === "Check In"){
              console.log("Check In: ", check);
              if(currentToolType.using > 0){
                // console.log("currentToolType.using > 0: ", currentToolType.using);
                currentToolType.available++;
                currentToolType.using--;
              }else{ 
                // console.log("currentToolType.using <= 0: ", currentToolType.using);
                return res.status(400).send(`Can not process request "${check}". No items are currently checked out`);//TODO: convert to {message: ''} 
              }
            }else{
              // console.log("Invalid check: ", check);
              return res.status(400).send('Invalid entry for the field "Check In or Out".');
            }

            
            await document.save();
            await currentToolType.save();
            
            // console.log("document.logRecord: ", document.logRecord, ", currentToolType: ", currentToolType);

            // console.log("currentToolType: ", currentToolType);
            
            res.status(200).send('Tool log record added successfully.');
          }else{
            res.status(404).send('Tool with this id was not found.');
          }
        }catch(error){
          console.log("183. error: ", error); //delete later
          res.status(500).send(error);
        }
      }

      return {
        fetchSingleTool,
        bmPurchaseTools,
        bmLogTools
      };
};

module.exports = bmToolController;
