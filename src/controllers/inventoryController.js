const mongoose = require('mongoose');
const moment = require('moment');
// const UserProfile = require('../models/userProfile');
const projects = require('../models/project');
const wbs = require('../models/wbs');

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
      $gte: { quantity: 0 },
    })
      .populate({
        path: 'project',
        select: '_id projectName',
      })
      .populate({
        path: 'wbs',
        select: '_id wbsName',
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

  const postInvInProjectWBS = async function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to view inventory data.');
    }
    // use req.body.projectId and req.body.wbsId req.body.quantity,
    // req.body.cost, req.body.ponum and req.body.typeId, req.body.message
    // create the item  using that information with cost per quantity being a calculation.
    //  Add a note field with "Created/Purchased" in the typeOfMovement field quantity being the full quantity and message being the req.body.message
    // make sure the item is saved and
    // send result just sending sucess and any information returned
    const projectExists = await projects.findOne({ _id: req.params.projectId }).select('_id').lean();
    let wbsExists = true;
    if (req.params.wbsId && req.params.wbsId !== 'Unassigned') {
      wbsExists = await wbs.findOne({ _id: req.params.wbsId }).select('_id').lean();
    }
    if (req.body.quantity && req.body.typeId && projectExists && wbsExists) {
      const inventoryExists = await Item.findOne({
        project: mongoose.Types.ObjectId(req.params.projectId),
        wbs: req.params.wbsId && req.params.wbsId !== 'Unassigned'
          ? mongoose.Types.ObjectId(req.params.wbsId)
          : null,
        inventoryItemType: req.body.typeId || req.body.typeID,
        wasted: false,
      }).select('_id').lean();
      if (!inventoryExists) {
        const data = {
          quantity: req.body.quantity,
          poNums: [req.body.poNum],
          cost: req.body.cost,
          inventoryItemType: req.body.typeId || req.body.typeID,
          wasted: false,
          project: mongoose.Types.ObjectId(req.params.projectId),
          wbs: req.params.wbsId && req.params.wbsId !== 'Unassigned'
            ? mongoose.Types.ObjectId(req.params.wbsId)
            : null,
          notes: [{ quantity: req.body.quantity, typeOfMovement: 'Purchased', message: `Created ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` }],
          created: Date.now(),
        };
        const inventoryItem = new Item(data);

        return inventoryItem.save()
          .then(results => res.status(201).send(results))
          .catch(errors => res.status(500).send(errors));
      }
      return Item.findOneAndUpdate({
        project: mongoose.Types.ObjectId(req.params.projectId),
        wbs: req.params.wbsId && req.params.wbsId !== 'Unassigned'
          ? mongoose.Types.ObjectId(req.params.wbsId)
          : null,
        inventoryItemType: req.body.typeId || req.body.typeID,
        wasted: false,
      },
      {
        $inc: { quantity: req.body.quantity, cost: req.body.cost },
        $push: {
          notes: { quantity: req.body.quantity, typeOfMovement: 'Purchased', message: `Created ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` },
          poNums: req.body.poNum,
        },
      }, { new: true })
        .then((results) => {
          Item.findByIdAndUpdate(results._id, { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 }, { new: true })
            .then(result => res.status(201).send(result));
        });
    }
    return res.status(400).send('Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned');
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
      $gte: { quantity: 0 },
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

  const postInvInProject = async function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to post new inventory data.');
    }
    // same as posting an item inProjectWBS but the WBS is uanassigned(i.e. null)

    // Check that both the project and type exists otherwise send an error
    const projectExists = await projects.findOne({ _id: req.params.projectId }).select('_id').lean();
    const typeExists = await ItemType.findOne({ _id: req.body.typeId || req.body.typeID }).select('_id').lean();
    if (req.body.quantity && typeExists && projectExists) {
      // See if there is an inventory item already in the project/wbs that is not wasted and of that type.
      const inventoryExists = await Item.findOne({
        project: mongoose.Types.ObjectId(req.params.projectId), wbs: null, inventoryItemType: req.body.typeId || req.body.typeID, wasted: false,
      }).select('_id').lean();
      // If no inventory create a new object and save it.
      if (!inventoryExists) {
        const data = {
          quantity: req.body.quantity,
          poNums: [req.body.poNum],
          cost: req.body.cost,
          inventoryItemType: req.body.typeId || req.body.typeID,
          wasted: false,
          project: mongoose.Types.ObjectId(req.params.projectId),
          wbs: null,
          notes: [{ quantity: req.body.quantity, typeOfMovement: 'Purchased', message: `Created ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` }],
          created: Date.now(),
        };
        const inventoryItem = new Item(data);

        return inventoryItem.save()
          .then(results => res.status(201).send(results))
          .catch(errors => res.status(500).send(errors));
      }
      // if item does exist we will update it
      return Item.findOneAndUpdate({
        project: mongoose.Types.ObjectId(req.params.projectId), wbs: null, inventoryItemType: req.body.typeId || req.body.typeID, wasted: false,
      },
      {
        $inc: { quantity: req.body.quantity, cost: req.body.cost },
        $push: {
          notes: { quantity: req.body.quantity, typeOfMovement: 'Purchased', message: `Created ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` },
          poNums: req.body.poNum,
        },
      }, { new: true })
        .then((results) => {
          // new call to update the costPer using the new quantities and cost
          Item.findByIdAndUpdate(results._id, { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 }, { new: true })
            .then(result => res.status(201).send(result))
            .catch(errors => res.status(500).send(errors));
        });
    }
    return res.status(400).send('Valid Project, Quantity and Type Id are necessary');
  };

  // inventoryRouter.route('/invtransfer/:invId') //Transfer some or all of the inventory to another project/wbs
  //   .put(controller.transferInvById);
  const transferInvById = async function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to transfer inventory data.');
    }
    // This function transfer inventory by id
    // req.body.projectId(new projectId), req.body.notes, req.body.quantity and req.body.wbsId(can be null for unassigned)
    // will be the data with req.param.invId identifying the item to move.

    // Check that the item to be transferred exists and there is at least that much quantity available
    const properTransfer = await Item.findOne({ _id: req.params.invId, $gte: { quantity: req.body.quantity }, wasted: false }).select('_id').lean();
    if (!properTransfer) {
      return res.status(400).send('You must send a valid Inventory Id with enough quantity that you requested to be transfered.');
    }

    // check that the project and wbs exists (Unassigned WBS would be a null wbs)
    const projectExists = await projects.findOne({ _id: req.body.projectId }).select('_id').lean();
    let wbsExists = true;
    if (req.params.wbsId && req.params.wbsId !== 'Unassigned') {
      wbsExists = await wbs.findOne({ _id: req.params.wbsId }).select('_id').lean();
    }

    // update the original item by decreasing by the quantity and adding a note
    if (req.body.quantity && req.param.invId && projectExists && wbsExists) {
      return Item.findByIdAndUpdate(req.param.invId, {
        $decr: { quantity: req.body.quantity },
        $push: {
          notes: {
            quantity: req.body.quantity,
            typeOfMovement: 'Transferred From',
            message: `Transfered out ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
          },
        },
      }, { new: true })
        .then((prevResults) => {
          if (!prevResults) {
            return;
          }
          // check if there is a new item that already exists
          Item.findOne({
            project: req.body.projectId,
            wbs: req.params.wbsId && req.params.wbsId !== 'Unassigned'
              ? mongoose.Types.ObjectId(req.params.wbsId)
              : null,
            wasted: false,
          }, { new: true })
            .then((newItem) => {
              // update the old item with the previous results
              Item.findByIdAndUpdate(prevResults._id, { $decr: { cost: (prevResults.costPer * req.body.quantity) } });
              // If the new item exists update it otherwise create one.
              if (newItem) {
                return Item.findByIdAndUpdate(newItem._id, {
                  $inc: { quantity: req.body.quantity, cost: (prevResults.costPer * req.body.quantity) },
                  $push: {
                    notes: { quantity: req.body.quantity, typeOfMovement: 'Transfered to', message: `Transfered in ${req.body.quantity} here on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` },
                    poNums: newItem.poNums,
                  },
                }, { new: true }).then((results) => {
                  Item.findByIdAndUpdate(results._id, { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 }, { new: true })
                    .then(result => res.status(201).send(result))
                    .catch(errors => res.status(500).send(errors));
                }).catch(errors => res.status(500).send(errors));
              }
              const data = {
                quantity: req.body.quantity,
                poNums: [req.body.poNum],
                cost: (prevResults.costPer * req.body.quantity),
                inventoryItemType: prevResults.inventoryItemType || req.body.typeID,
                wasted: false,
                project: mongoose.Types.ObjectId(req.params.projectId),
                wbs: req.params.wbsId && req.params.wbsId !== 'Unassigned'
                  ? mongoose.Types.ObjectId(req.params.wbsId)
                  : null,
                notes: [{ quantity: req.body.quantity, typeOfMovement: 'Purchased', message: `Tra ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` }],
                created: Date.now(),
              };
              const inventoryItem = new Item(data);

              return inventoryItem.save()
                .then(results => res.status(201).send({ from: prevResults, to: results }))
                .catch(errors => res.status(500).send(errors));
            })
            .catch(errors => res.status(500).send(errors));
        })
        .catch(errors => res.status(500).send(errors));
    }
    return res.status(400).send('Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned');
  };


  // inventoryRouter.route('/invwaste/:invId') //Waste some or all of the inventory
  //  .put(controller.unWasteInvById)
  //   .delete(controller.delInvById);
  const delInvById = async function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to waste inventory.');
    }
    // send result just sending something now to have it work and not break anything
    // Similar to transfer but changing from wasted false to a wasted true item

    const properWaste = await Item.findOne({ _id: req.params.invId, quantity: { $gte: req.body.quantity }, wasted: false }).select('_id').lean();
    if (!properWaste) {
      return res.status(400).send('You must send a valid Inventory Id with enough quantity that you requested to be wasted.');
    }

    const projectExists = await projects.findOne({ _id: req.body.projectId }).select('_id').lean();
    if (!projectExists) {
      return res.status(400).send(`Project does not exist ${req.body.projectId}`);
    }
    let wbsExists = true;
    if (req.body.wbsId && req.body.wbsId !== 'Unassigned') {
      wbsExists = await wbs.findOne({ _id: req.body.wbsId }).select('_id').lean();
    } else {
      return res.status(400).send(req.body.wbsId);
    }

    if (req.body.quantity && req.params.invId && projectExists && wbsExists) {
      return Item.findByIdAndUpdate(req.params.invId, {
        $decr: { quantity: req.body.quantity },
        $push: {
          notes: {
            quantity: req.body.quantity,
            typeOfMovement: 'Wasted from',
            message: `Wasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
          },
        },
      }, { new: true })
        .then((prevResults) => {
          if (!prevResults) {
            return;
          }
          // check if there is a new item that already exists
          Item.findOne({
            project: req.body.projectId,
            wbs: req.body.wbsId && req.body.wbsId !== 'Unassigned'
              ? mongoose.Types.ObjectId(req.body.wbsId)
              : null,
            wasted: true,
          }, { new: true })
            .then((newItem) => {
              // update the old item cost with the previous results
              Item.findByIdAndUpdate(prevResults._id, { $decr: { cost: (prevResults.costPer * req.body.quantity) } });
              // If the new item exists update it otherwise create one.
              if (newItem) {
                return Item.findByIdAndUpdate(newItem._id, {
                  $inc: { quantity: req.body.quantity, cost: (prevResults.costPer * req.body.quantity) },
                  $push: {
                    notes: { quantity: req.body.quantity, typeOfMovement: 'Wasted to', message: `Wasted ${req.body.quantity} here on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` },
                    poNums: newItem.poNums,
                  },
                }, { new: true }).then((results) => {
                  Item.findByIdAndUpdate(results._id, { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 }, { new: true })
                    .then(result => res.status(201).send(result))
                    .catch(errors => res.status(500).send(errors));
                }).catch(errors => res.status(500).send(errors));
              }
              const data = {
                quantity: req.body.quantity,
                poNums: [req.body.poNum],
                cost: (prevResults.costPer * req.body.quantity),
                inventoryItemType: prevResults.inventoryItemType || req.body.typeID,
                wasted: true,
                project: mongoose.Types.ObjectId(req.params.projectId),
                wbs: req.body.wbsId && req.body.wbsId !== 'Unassigned'
                  ? mongoose.Types.ObjectId(req.body.wbsId)
                  : null,
                notes: [{ quantity: req.body.quantity, typeOfMovement: 'Wasted to', message: `Wasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` }],
                created: Date.now(),
              };
              const inventoryItem = new Item(data);

              return inventoryItem.save()
                .then(results => res.status(201).send({ from: prevResults, to: results }))
                .catch(errors => res.status(500).send(errors));
            })
            .catch(errors => res.status(500).send(errors));
        })
        .catch(errors => res.status(500).send(errors));
    }
    return res.status(400).send('Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned');
  };

  const unWasteInvById = async function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to unwaste inventory.');
    }
    const properUnWaste = await Item.findOne({ _id: req.params.invId, quantity: { $gte: req.body.quantity }, wasted: true }).select('_id').lean();
    if (!properUnWaste) {
      return res.status(400).send('You must send a valid Inventory Id with enough quantity that you requested to be unwasted.');
    }

    const projectExists = await projects.findOne({ _id: req.body.projectId }).select('_id').lean();
    let wbsExists = true;
    if (req.body.wbsId && req.body.wbsId !== 'Unassigned') {
      wbsExists = await wbs.findOne({ _id: req.body.wbsId }).select('_id').lean();
    }

    if (req.body.quantity && req.params.invId && projectExists && wbsExists) {
      return Item.findByIdAndUpdate(req.params.invId, {
        $decr: { quantity: req.body.quantity },
        $push: {
          notes: {
            quantity: req.body.quantity,
            typeOfMovement: 'UnWasted from',
            message: `UnWasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
          },
        },
      }, { new: true })
        .then((prevResults) => {
          if (!prevResults) {
            return;
          }
          // check if there is a new item that already exists
          Item.findOne({
            project: req.body.projectId,
            wbs: req.body.wbsId && req.body.wbsId !== 'Unassigned'
              ? mongoose.Types.ObjectId(req.body.wbsId)
              : null,
            wasted: false,
          }, { new: true })
            .then((newItem) => {
              // update the old item cost with the previous results
              Item.findByIdAndUpdate(prevResults._id, { $decr: { cost: (prevResults.costPer * req.body.quantity) } });
              // If the new item exists update it otherwise create one.
              if (newItem) {
                return Item.findByIdAndUpdate(newItem._id, {
                  $inc: { quantity: req.body.quantity, cost: (prevResults.costPer * req.body.quantity) },
                  $push: {
                    notes: { quantity: req.body.quantity, typeOfMovement: 'UnWasted to', message: `UnWasted ${req.body.quantity} here on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` },
                    poNums: newItem.poNums,
                  },
                }, { new: true }).then((results) => {
                  Item.findByIdAndUpdate(results._id, { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 }, { new: true })
                    .then(result => res.status(201).send(result))
                    .catch(errors => res.status(500).send(errors));
                }).catch(errors => res.status(500).send(errors));
              }
              const data = {
                quantity: req.body.quantity,
                poNums: [req.body.poNum],
                cost: (prevResults.costPer * req.body.quantity),
                inventoryItemType: prevResults.inventoryItemType || req.body.typeID,
                wasted: false,
                project: mongoose.Types.ObjectId(req.body.projectId),
                wbs: req.body.wbsId && req.body.wbsId !== 'Unassigned'
                  ? mongoose.Types.ObjectId(req.body.wbsId)
                  : null,
                notes: [{ quantity: req.body.quantity, typeOfMovement: 'UnWasted to', message: `UnWasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` }],
                created: Date.now(),
              };
              const inventoryItem = new Item(data);

              return inventoryItem.save()
                .then(results => res.status(201).send({ from: prevResults, to: results }))
                .catch(errors => res.status(500).send(errors));
            })
            .catch(errors => res.status(500).send(errors));
        })
        .catch(errors => res.status(500).send(errors));
    }
    return res.status(400).send('Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned');
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
    return Item.findById({ _id: req.params.invId })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
    // return res.send('Success');
  };

  const putInvById = function (req, res) {
    if (!['Manager', 'Administrator', 'Core Team'].includes(req.body.requestor.role)) {
      return res.status(403).send('You are not authorized to edit inventory by id.');
    }
    // update the inv by id.
    // send result just sending something now to have it work and not break anything
    const { invId } = req.params;
    // return res.send('Success');
    const data = {
      quantity: req.body.quantity,
      poNums: [req.body.poNum],
      cost: req.body.cost,
      inventoryItemType: req.body.typeId || req.body.typeID,
      wasted: false,
      project: mongoose.Types.ObjectId(req.params.projectId),
      wbs: null,
      notes: [{ quantity: req.body.quantity, typeOfMovement: 'Purchased', message: `Created ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}` }],
      created: Date.now(),
    };

    return Item.findByIdAndUpdate(invId, data, (error, record) => {
      if (error || record == null) {
        res.status(400).send({ error: 'No Valid records found' });
        return;
      }
      res.status(200).send({ message: 'Inventory successfully updated ' });
    });
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
    return ItemType.findById({ _id: req.params.typeId })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
    // return res.send('Success');
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
