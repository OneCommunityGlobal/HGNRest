const mongoose = require('mongoose');

const bmToolController = (BuildingTool, ToolType) => {
  // const fetchAllTools = async (req, res) => {
  //   try {
  //     BuildingTool.find()
  //     .populate([
  //       {
  //         path: 'project',
  //         select: '_id name',
  //       },
  //       {
  //         path: 'itemType',
  //         select: '_id name description unit imageUrl category available using',
  //       },
  //       {
  //         path: 'updateRecord',
  //         populate: {
  //           path: 'createdBy',
  //           select: '_id firstName lastName',
  //         },
  //       },
  //       {
  //         path: 'purchaseRecord',
  //         populate: {
  //           path: 'requestedBy',
  //           select: '_id firstName lastName',
  //         },
  //       },
  //       {
  //         path: 'logRecord',
  //         populate: [{
  //             path: 'createdBy',
  //             select: '_id firstName lastName',
  //         },
  //         {
  //             path: 'responsibleUser',
  //             select: '_id firstName lastName',
  //     }],
  //     },
  //     ])
  //     .exec()
  //     .then(results => res.status(200).send(results))
  //     .catch(error => res.status(500).send(error));
  //   } catch (err) {
  //     res.json(err);
  // }
  // };
  
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
        const requestor = req.body.requestor.requestorId;
        const {typesArray, action, date} = req.body
        console.log("requestor: ",requestor, ", action: ",action, ", date: ", date);
        if(typesArray.length === 0 && typesArray === undefined){
          return res.status(500).send({ message: 'Invalid request. No tool types selected'});
        }
         
        try{
          for (const type of typesArray) {
            const toolTypeDoc = await ToolType.findOne({ _id: mongoose.Types.ObjectId(type.toolType) });
            if (!toolTypeDoc) {
            //  console.log("Tool type with this id was not found")
             return res.status(404).send({ message: 'Tool type with this id was not found.'});
            }
            // console.log("toolTypeDoc found, name: ", toolTypeDoc.name)
            const availableItems = toolTypeDoc.available;
            const usingItems = toolTypeDoc.using;
            // console.log("availableItems: ", availableItems, ", usingItems: ", usingItems)
            
            type.toolItems.forEach(async toolItem=>{
              // console.log("looping toolItems. toolItem id: ", toolItem);
              if(action === "Check Out" && availableItems.length > 0){
                  // console.log("check out && availableItems > 0")
                  const foundIndex = availableItems.indexOf(toolItem);
                  if(foundIndex >= 0){
                    // console.log("found toolItem in availableItems: ", foundIndex);
                    availableItems.splice(foundIndex, 1);
                    usingItems.push(toolItem);
                  }else{
                    console.log("Didn't find this id in availableItems array")
                    return res.status(404).send({ message: `Tool item with id ${toolItem} is not available for ${action}`});
                  }
              }else if(action === "Check Out" && availableItems.length < 0){
                console.log(`168. Can not process request "${action}". ${toolTypeDoc.name} stock exceeded`)
                return res.status(404).send({ message: `Can not process request "${action}". ${toolTypeDoc.name} stock exceeded`});       
              }

              if(action === "Check In" && usingItems.length > 0){
                const foundIndex = usingItems.indexOf(toolItem);
                  if(foundIndex >= 0){
                    usingItems.splice(foundIndex, 1);
                    availableItems.push(toolItem);
                  }else{
                    console.log("Didn't find this id in usingItems array")
                    return res.status(404).send({ message: `Tool item with id ${toolItem} is not available for ${action}`});
                  }
              } else if(action === "Check In" && usingItems.length < 0){
                console.log(`168. Can not process request "${action}". No items of type ${toolTypeDoc.name} are currently checked out`)
                return res.status(404).send({ message: `Can not process the request "${action}". No items of type ${toolTypeDoc.name} are currently checked out`});
              }
              // if we are here the function did not return 
              const buildingToolDoc = await BuildingTool.findOne({ _id: mongoose.Types.ObjectId(toolItem)});
              if(!buildingToolDoc){
                console.log("STATUS 404 didnt find item ");
                return res.status(404).send({message: 'Tool item with this id was not found.'});
              }
              // console.log("found item buildingToolDoc, ", buildingToolDoc._id);
              const newRecord = {
                date: date,
                createdBy: requestor,
                responsibleUser: buildingToolDoc.userResponsible, 
                type: action
              }

              buildingToolDoc.logRecord.push(newRecord);
              console.log("buildingToolDoc.logRecord: ", buildingToolDoc.logRecord)
              buildingToolDoc.save();
              // console.log("saved buildingToolDoc (tool item)");
            })

            await toolTypeDoc.save();
            console.log("saved toolTypeDoc");
            console.log("######################## end of outer loop iteration");
          } //end loop through typesArray 
          console.log("end loop through typesArray ");
          res.status(200).send({message: `Log request "${action}" processed successfully!`});
        }catch(error){
            console.log("183. error: ", error); //delete later
            res.status(500).send(error);
        }
      }

      return {
        // fetchAllTools,
        fetchSingleTool,
        bmPurchaseTools,
        bmLogTools
      };
};

module.exports = bmToolController;
