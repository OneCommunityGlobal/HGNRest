const mongoose = require('mongoose');

const bmToolController = (BuildingTool) => {
    
    const fetchAllTools = (req, res) => {
      const populateFields = [
        {
          path: 'project',
          select: '_id name',
        },
        {
          path: 'itemType',
          select: '_id name description unit imageUrl category available using',
        },
        {
          path: 'updateRecord',
          populate: {
            path: 'createdBy',
            select: '_id firstName lastName',
          },
        },
        {
          path: 'purchaseRecord',
          populate: {
            path: 'requestedBy',
            select: '_id firstName lastName',
          },
        },
        {
          path: 'logRecord',
          populate: [
            {
              path: 'createdBy',
              select: '_id firstName lastName',
            },
            {
              path: 'responsibleUser',
              select: '_id firstName lastName',
            },
          ],
        },
      ];

      BuildingTool.find()
        .populate(populateFields)
        .exec()
        .then(results => {
          res.status(200).send(results);
        })
        .catch(error => {
          const errorMessage = `Error occurred while fetching tools: ${error.message}`;
          console.error(errorMessage);
          res.status(500).send({ message: errorMessage });
        });
    };
    


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
        const requestor = req.body.requestor.requestorId;
        const {typesArray, action, date} = req.body
        const results = [];
        const errors = [];

        if(typesArray.length === 0 || typesArray === undefined){
          errors.push({ message: 'Invalid request. No tools selected'})
          return res.status(500).send({errors, results});
        }
        
        for (const type of typesArray) {
          const toolName = type.toolName; 
          const toolCodes = type.toolCodes; 
          const codeMap = {};
          toolCodes.forEach(obj => {
            codeMap[obj.value] = obj.label;
          })

          try{
            const toolTypeDoc = await ToolType.findOne({ _id: mongoose.Types.ObjectId(type.toolType) });
            if(!toolTypeDoc) {
              errors.push({ message: `Tool type ${toolName} with id ${type.toolType} was not found.`});
              continue; 
            }
            const availableItems = toolTypeDoc.available;
            const usingItems = toolTypeDoc.using;
          
            for(const toolItem of type.toolItems){
              const buildingToolDoc = await BuildingTool.findOne({ _id: mongoose.Types.ObjectId(toolItem)});
              if(!buildingToolDoc){ 
                errors.push({ message: `${toolName} with id ${toolItem} was not found.`});
                continue; 
              }
              
              if(action === "Check Out" && availableItems.length > 0){
                const foundIndex = availableItems.indexOf(toolItem);
                if(foundIndex >= 0){
                  availableItems.splice(foundIndex, 1);
                  usingItems.push(toolItem);
                }else{ 
                  errors.push({ message: `${toolName} with code ${codeMap[toolItem]} is not available for ${action}`});
                  continue; 
                }
               } 
              
              if(action === "Check In" && usingItems.length > 0){
                const foundIndex = usingItems.indexOf(toolItem);
                if(foundIndex >= 0){
                  usingItems.splice(foundIndex, 1);
                  availableItems.push(toolItem);
                }else{
                  errors.push({ message: `${toolName} ${codeMap[toolItem]} is not available for ${action}`});
                  continue; 
                }
              }

              const newRecord = {
                date: date,
                createdBy: requestor,
                responsibleUser: buildingToolDoc.userResponsible, 
                type: action
              }

              buildingToolDoc.logRecord.push(newRecord);
              buildingToolDoc.save();
              results.push({message: `${action} successful for ${toolName} ${codeMap[toolItem]}`})
            }

            await toolTypeDoc.save();
            }catch(error){
            errors.push({message: `Error for tool type ${type}: ${error.message}` });
          }
        }

        if (errors.length > 0) {
          return res.status(404).send({ errors, results });
        } else {
          return res.status(200).send({ errors, results });
        }
      }

      return {
        fetchAllTools,
        fetchSingleTool,
        bmPurchaseTools,
        bmLogTools
      };
};

module.exports = bmToolController;
