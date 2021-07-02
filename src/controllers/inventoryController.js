const mongoose = require('mongoose');
// const UserProfile = require('../models/userProfile');

const inventoryController = function (Item, ItemType) {
// inventoryRouter.route('/inv/:projectId/wbs/:wbsId') //All By Project seperated into WBS (wbs can be nill which is the unassigned category)
  //   .get(controller.getAllInvInProjectWBS)
  //   .post(controller.postInvInProjectWBS); //Can create a new inventory item in a project with a specified wbs
  const getAllInvInProjectWBS = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to view inventory data.');
    }
    // use req.params.projectId and wbsId
    // Run a mongo query on the Item model to find all items with both the project and wbs
    // sort the mongo query so that the Wasted false items are listed first
    return Item.find({
      project: mongoose.Types.ObjectId(req.params.projectId),
      wbs: req.params.wbsId && req.params.wbsId !== 'Unassigned'
        ? mongoose.Types.ObjectId(req.params.wbsId)
        : null,
    })
      .populate({
        path: 'project',
        select: '_id projectName',
      })
      .populate({
        path: 'wbs',
        select: '_id wbsName',
        options: { sort: { wbsName: 1 } },
      })
      .populate({
        path: 'inventoryItemType',
        select: '_id name description imageUrl quantifier',
      })
      .sort({
        wasted: 1,
      })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
    //     console.log(mongoose, UserProfile, Item, ItemType); //console logging as we need to use it to commit
    // send result just sending something now to have it work and not break anything
  };

  const postInvInProjectWBS = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to view inventory data.');
    }
    // use req.body.projectId and req.body.wbsId req.body.quantity,
    // req.body.cost, req.body.ponum and req.body.typeId, req.body.message
    // create the item  using that information with cost per quantity being a calculation.
    //  Add a note field with "Created/Purchased" in the typeOfMovement field quantity being the full quantity and message being the req.body.message
    // make sure the item is saved and
    // send result just sending sucess and any information returned
    const item = new Item();

    item.quantity = req.body.quantity;
    item.poNums = [req.body.poNum];
    item.cost = req.body.cost;
    item.inventoryItemType = req.body.typeId;
    item.wasted = false;
    item.project = req.params.projectId;
    item.wbs = req.params.wbsId;
    item.notes = [{ quantity: req.body.quantity, typeOfMovement: 'Purchased', message: `Created ${req.body.quanity} on ${Date.now().toString()} note: ${req.body.notes}` }];

    return item.save()
      .then(results => res.status(201).send(results))
      .catch(errors => res.status(500).send(errors));
  };


  // inventoryRouter.route('/inv/:projectId') //All By Project seperated into WBS (wbs can be nill which is the unassigned category)
  //   .get(controller.getAllInvInProject)
  //   .post(controller.postInvInProject); //Can create a new inventory item in a project with unassigned wbs
  const getAllInvInProject = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to view inventory data.');
    }
    // same as getAllInvInProjectWBS but just using only the project to find the items of inventory
    // this time the list of objects returned should be sorted first by wbs(with null which means unassigned wbs being first)
    // then inside each wbs have it sorted by the wasted with false being before true
    // send result just sending something now to have it work and not break anything
    return Item.find({
      project: mongoose.Types.ObjectId(req.params.projectId),
    })
      .populate({
        path: 'project',
        select: '_id projectName',
      })
      .populate({
        path: 'wbs',
        select: '_id wbsName',
        options: { sort: { wbsName: 1 } },
      })
      .populate({
        path: 'inventoryItemType',
        select: '_id name description imageUrl quantifier',
      })
      .sort({
        wasted: 1,
      })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const postInvInProject = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to post new inventory data.');
    }
    // same as posting an item inProjectWBS but the WBS is uanassigned(i.e. null)
    // but same process
    // send result just sending something now to have it work and not break anything
    // use req.params.projectId and req.body.quantity,
    // req.body.cost, req.body.ponum and req.body.typeId, req.body.message
    // create the item  using that information with cost per quantity being a calculation.
    //  Add a note field with "Created/Purchased" in the typeOfMovement field quantity being the full quantity and message being the req.body.message
    // make sure the item is saved and
    // send result just sending sucess and any information returned
    const item = new Item();

    item.quantity = req.body.quantity;
    item.poNums = [req.body.poNum];
    item.cost = req.body.cost;
    item.inventoryItemType = req.body.typeId;
    item.wasted = false;
    item.project = req.params.projectId;
    item.wbs = null;
    item.notes = [{ "quantity": req.body.quantity, typeOfMovement: 'Purchased', message: `Created ${req.body.quanity} on ${Date.now().toString()} note: ${req.body.notes}` }];

    return item.save()
      .then(results => res.status(201).send(results))
      .catch(errors => res.status(500).send(errors));
  };

  // inventoryRouter.route('/invtransfer/:invId') //Transfer some or all of the inventory to another project/wbs
  //   .put(controller.transferInvById);
  const transferInvById = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to transfer inventory data.');
    }
    // This function transfer inventory by id
    // req.body.projectId, req.body.message, req.body.quantity and req.body.wbsId(can be null for unassigned)
    // will be the data with req.param.invId
    // identifying the item to move.
    // First check if there is an item with the same type in the destination project/wbs that is not wasted
    // If there is then move the quantity over to that item subtract the cost of that quantity from
    // the past item(take quantity moved * cost per quantity) and add the cost to the new item transfered over
    // Add any PO numbers to the end of the array
    // If no item non wasted item with the same type then create the item just like normal
    // copying over the information such as PO numbers and cost etc
    // create a note with the message in both the new/transfered to and old/transferred from
    // use type transfer
    // If the entire quantity was moved delete the old item.
    // send result just sending something now to have it work and not break anything
    return res.send('Success');
  };


  // inventoryRouter.route('/invwaste/:invId') //Waste some or all of the inventory
  //  .put(controller.unWasteInvById)
  //   .delete(controller.delInvById);
  const delInvById = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to waste inventory.');
    }
    // send result just sending something now to have it work and not break anything
    // Similar to transfer but changing from wasted false to a wasted true item
    // first try to find that item in the wasted section of the project/wbs it is in
    // and move it if needed if the entire quanity is used delete it/if the entire quantity is used
    // make sure to update the costs and costs per quantity on both items
    return res.send('Success');
  };

  const unWasteInvById = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to unwaste inventory.');
    }
    // send result just sending something now to have it work and not break anything
    // Inverse of Wasted /an internal transfer
    return res.send('Success');
  };

  // inventoryRouter.route('/inv/:invId') //Single Inventory By Inv ID
  //   .get(controller.getInvIdInfo)
  //   .put(controller.putInvById);
  const getInvIdInfo = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to get inventory by id.');
    }
    // req.params.invId
    // Look up an inventory item by id and send back the info as jsong
    // send result just sending something now to have it work and not break anything
    return res.send('Success');
  };

  const putInvById = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to edit inventory by id.');
    }
    // update the inv by id.
    // send result just sending something now to have it work and not break anything
    return res.send('Success');
  };


  //   inventoryRouter.route('/invtype/:typeId')
  //   .get(controller.getInvTypeById)
  //   .put(controller.putInvType);
  const getInvTypeById = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to get inv type by id.');
    }
    // send result just sending something now to have it work and not break anything
    // Use model ItemType and return the find by Id
    return res.send('Success');
  };

  const putInvType = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to edit an inventory type.');
    }
    const { typeId } = req.params;
    // send result just sending something now to have it work and not break anything
    // Change an invType
    const data = {
      name: req.body.name,
      description: req.body.description,
      imageUrl: req.body.imageUrl || req.body.imageURL,
      quantifier: req.body.quantifier,
    };

    return ItemType.findByIdAndUpdate(typeId, data, (error, record) => {
      if (error || record === null) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }
      res.status(200).send({ message: 'Inv Type successfully updated' });
    });
  };


  //   inventoryRouter.route('/invtype')
  //   .get(controller.getAllInvType)
  //   .post(controller.postInvType);
  const getAllInvType = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to get all inventory.');
    }
    // send result just sending something now to have it work and not break anything
    return ItemType.find({})
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const postInvType = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to save an inventory type.');
    }
    return ItemType.find({ name: { $regex: req.body.name, $options: 'i' } })
      .then((result) => {
        if (result.length > 0) {
          res.status(400).send({ error: `Another ItemType with name ${req.body.name} already exists. Sorry, but item names should be like snowflakes, no two should be the same.` });
          return;
        }
        const itemType = new ItemType();

        itemType.name = req.body.name;
        itemType.description = req.body.description;
        itemType.imageUrl = req.body.imageUrl || req.body.imageURL;
        itemType.quantifier = req.body.quantifier;

        itemType.save()
          .then(results => res.status(201).send(results))
          .catch(errors => res.status(500).send(errors));
      });
    // send result just sending something now to have it work and not break anything
    // create an inventory type req.body.name, req.body.description, req.body.imageUrl, req.body.quantifier
  };

  return {
    getAllInvInProjectWBS,
    postInvInProjectWBS,
    postInvInProject,
    getAllInvInProject,
    putInvById,
    delInvById,
    getInvIdInfo,
    transferInvById,
    putInvType,
    getInvTypeById,
    getAllInvType,
    postInvType,
    unWasteInvById,
  };
};

module.exports = inventoryController;
