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
        const requestor = req.body.requestor.requestorId;
        // const typesArray = req.body.typesArray;
        // const action = req.body.action; 
        // const date = req.body.date;
        const {typesArray, action, date} = req.body
        console.log("requestor: ",requestor, /*", typesArray: ", typesArray,*/ ", action: ",action, ", date: ", date);

         
        try{
          console.log("try block")
          for (const type of typesArray) {
            console.log("looping typesArray")
            const toolTypeDoc = await ToolType.findOne({ _id: mongoose.Types.ObjectId(type.toolType) });
            if (!toolTypeDoc) {
             console.log("Tool type with this id was not found")
             return res.status(404).send('Tool type with this id was not found.');
            }
            console.log("toolTypeDoc found, name: ", toolTypeDoc.name)
            const availableItems = toolTypeDoc.available;
            const usingItems = toolTypeDoc.using;
            console.log("availableItems: ", availableItems, ", usingItems: ", usingItems)
            //is it more efficient to loop through type.toolItems first and then perform an action accord to check in or check out? Might reduce the amount of code! 
        
            
            type.toolItems.forEach(async toolItem=>{
              console.log("looping toolItems. toolItem code: ", toolItem.code);
              if(action === "Check Out" && availableItems.length > 0){
                  console.log("check out && availableItems > 0")
                  const foundIndex = availableItems.indexOf(toolItem);
                  if(foundIndex >= 0){
                    console.log("found toolItem in availableItems: ", foundIndex);
                    availableItems.splice(foundIndex, 1);
                    usingItems.push(toolItem);
                    console.log("Check out spliced and pushed")
                  }else{
                    console.log("Didn't find this id in availableItems array")
                    //return 400
                  }
              }else if(action === "Check Out" && availableItems.length < 0){
                console.log(`168. Can not process request "${action}". ${toolTypeDoc.name} stock exceeded`)
               // return 400          
              }

              if(action === "Check In" && usingItems.length > 0){
                console.log("check in && usingItems > 0")
                const foundIndex = usingItems.indexOf(toolItem);
                  
                  if(foundIndex >= 0){
                    console.log("found toolItem in usingItems: ", foundIndex);
                    usingItems.splice(foundIndex, 1);
                    availableItems.push(toolItem);
                    console.log("Check in spliced and pushed")
                  }else{
                    console.log("Didn't find this id in availableItems array")
                    // return 400
                  }
              } else if(action === "Check In" && usingItems.length < 0){
                console.log(`168. Can not process request "${action}". No items of type ${toolTypeDoc.name} are currently checked out`)
                // return 400
              }
              // if we are here the function did not return 
              const buildingToolDoc = await BuildingTool.findOne({ _id: mongoose.Types.ObjectId(toolItem)});
              if(!buildingToolDoc){
                console.log("STATUS 404 didnt find item ");
                // return res.status(404).send({message: 'Tool item with this id was not found.'});
              }
              console.log("found item buildingToolDoc, ", buildingToolDoc._id);
              const newRecord = {
                date: date,
                createdBy: requestor,
                responsibleUser: buildingToolDoc.userResponsible, 
                type: action
              }
              buildingToolDoc.logRecord.push(newRecord);
              console.log("buildingToolDoc.logRecord: ", buildingToolDoc.logRecord)
              buildingToolDoc.save();
              console.log("saved buildingToolDoc");
            })
            await toolTypeDoc.save();
          } //end loop through typesArray 
          res.status(200).send({message: 'Log request processed successfully!'});
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
