/* eslint-disable */
const mongoose = require('mongoose');
const moment = require('moment');
const wbs = require('../models/wbs');
const escapeRegex = require('../utilities/escapeRegex');
const helper = require('../utilities/permissions');
const { hasPermission } = require('../utilities/permissions');

// New purchases historically return timestamp failures as messages, rather than error objects.
class InventoryPurchaseTimestampError extends Error {}

const inventoryController = function (Item, ItemType, projects) {
  const getAllInvInProjectWBS = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'getAllInvInProjectWBS'))) {
      return res.status(403).send('You are not authorized to view inventory data.');
    }
    // use req.params.projectId and wbsId
    // Run a mongo query on the Item model to find all items with both the project and wbs
    // sort the mongo query so that the Wasted false items are listed first
    await Item.find({
      project: mongoose.Types.ObjectId(req.params.projectId),
      wbs:
        req.params.wbsId && req.params.wbsId !== 'Unassigned'
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
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  // Keep the project-level sort timestamp monotonic and wait for persistence.
  const updateProjectInventoryModifiedTime = async function (projectId) {
    const project = await projects.findByIdAndUpdate(
      projectId,
      { $max: { inventoryModifiedDatetime: new Date() } },
      { new: true },
    );
    if (!project) throw new Error('Project not found while updating inventory timestamp');
    return project;
  };

  const getPurchaseMatch = (projectId, wbsId, purchase) => ({
    project: mongoose.Types.ObjectId(projectId),
    wbs: wbsId && wbsId !== 'Unassigned' ? mongoose.Types.ObjectId(wbsId) : null,
    inventoryItemType: purchase.typeId || purchase.typeID,
    wasted: false,
  });

  const saveInventoryPurchase = async ({ projectId, wbsId, purchase, inventoryExists }) => {
    const match = getPurchaseMatch(projectId, wbsId, purchase);
    const note = {
      quantity: purchase.quantity,
      typeOfMovement: 'Purchased',
      message: `Created ${purchase.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${purchase.notes}`,
    };
    let record;
    if (inventoryExists) {
      const updated = await Item.findOneAndUpdate(
        match,
        {
          $inc: { quantity: purchase.quantity, cost: purchase.cost },
          $push: { notes: note, poNums: purchase.poNum },
        },
        { new: true },
      );
      record = await Item.findByIdAndUpdate(
        updated._id,
        { costPer: updated.quantity !== 0 ? updated.cost / updated.quantity : 0 },
        { new: true },
      );
    } else {
      const inventoryItem = new Item({
        ...match,
        quantity: purchase.quantity,
        poNums: [purchase.poNum],
        cost: purchase.cost,
        notes: [note],
        created: Date.now(),
      });
      record = await inventoryItem.save();
    }

    try {
      await updateProjectInventoryModifiedTime(projectId);
    } catch (error) {
      if (!inventoryExists) {
        throw new InventoryPurchaseTimestampError(error.message, { cause: error });
      }
      throw error;
    }
    return record;
  };

  // Add purchased inventory to the project/WBS, preserving purchase history.
  // Save the project inventory timestamp before returning success.
  const postInvInProjectWBS = async function (req, res) {
    if (!(await helper.hasPermission(req.body.requestor, 'postInvInProjectWBS'))) {
      return res.status(403).send('You are not authorized to view inventory data.');
    }
    const projectExists = await projects
      .findOne({ _id: req.params.projectId })
      .select('_id')
      .lean();
    let wbsExists = true;
    if (req.params.wbsId && req.params.wbsId !== 'Unassigned') {
      wbsExists = await wbs.findOne({ _id: req.params.wbsId }).select('_id').lean();
    }
    if (req.body.quantity && req.body.typeId && projectExists && wbsExists) {
      const inventoryExists = await Item.findOne(
        getPurchaseMatch(req.params.projectId, req.params.wbsId, req.body),
      )
        .select('_id')
        .lean();
      try {
        const record = await saveInventoryPurchase({
          projectId: req.params.projectId,
          wbsId: req.params.wbsId,
          purchase: req.body,
          inventoryExists,
        });
        return res.status(201).send(record);
      } catch (error) {
        return res
          .status(500)
          .send(error instanceof InventoryPurchaseTimestampError ? error.message : error);
      }
    }
    return res
      .status(400)
      .send(
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
      );
  };

  const getAllInvInProject = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'getAllInvInProject'))) {
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
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  // Add purchased inventory to the project with no assigned WBS, preserving purchase history.
  // Save the project inventory timestamp before returning success.
  const postInvInProject = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'postInvInProject'))) {
      return res.status(403).send('You are not authorized to post new inventory data.');
    }
    // Check that both the project and type exists otherwise send an error
    const projectExists = await projects
      .findOne({ _id: req.params.projectId })
      .select('_id')
      .lean();
    const typeExists = await ItemType.findOne({ _id: req.body.typeId || req.body.typeID })
      .select('_id')
      .lean();
    if (req.body.quantity && typeExists && projectExists) {
      // See if there is an inventory item already in the project/wbs that is not wasted and of that type.
      const inventoryExists = await Item.findOne(
        getPurchaseMatch(req.params.projectId, null, req.body),
      )
        .select('_id')
        .lean();
      try {
        const record = await saveInventoryPurchase({
          projectId: req.params.projectId,
          wbsId: null,
          purchase: req.body,
          inventoryExists,
        });
        return res.status(201).send(record);
      } catch (error) {
        return res
          .status(500)
          .send(error instanceof InventoryPurchaseTimestampError ? error.message : error);
      }
    }
    return res.status(400).send('Valid Project, Quantity and Type Id are necessary');
  };

  const transferInvById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'transferInvById'))) {
      return res.status(403).send('You are not authorized to transfer inventory data.');
    }
    // This function transfer inventory by id
    // req.body.projectId(new projectId), req.body.notes, req.body.quantity and req.body.wbsId(can be null for unassigned)
    // will be the data with req.param.invId identifying the item to move.

    // Check that the item to be transferred exists and there is at least that much quantity available
    const properTransfer = await Item.findOne({
      _id: req.params.invId,
      $gte: { quantity: req.body.quantity },
      wasted: false,
    })
      .select('_id')
      .lean();
    if (!properTransfer) {
      return res
        .status(400)
        .send(
          'You must send a valid Inventory Id with enough quantity that you requested to be transfered.',
        );
    }

    // check that the project and wbs exists (Unassigned WBS would be a null wbs)
    const projectExists = await projects.findOne({ _id: req.body.projectId }).select('_id').lean();
    let wbsExists = true;
    if (req.params.wbsId && req.params.wbsId !== 'Unassigned') {
      wbsExists = await wbs.findOne({ _id: req.params.wbsId }).select('_id').lean();
    }

    // update the original item by decreasing by the quantity and adding a note
    if (req.body.quantity && req.params.invId && projectExists && wbsExists) {
      return Item.findByIdAndUpdate(
        req.params.invId,
        {
          $decr: { quantity: req.body.quantity },
          $push: {
            notes: {
              quantity: req.body.quantity,
              typeOfMovement: 'Transferred From',
              message: `Transfered out ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
            },
          },
        },
        { new: true },
      )
        .then((prevResults) => {
          if (!prevResults) {
            return;
          }
          // check if there is a new item that already exists
          Item.findOne(
            {
              project: req.body.projectId,
              wbs:
                req.params.wbsId && req.params.wbsId !== 'Unassigned'
                  ? mongoose.Types.ObjectId(req.params.wbsId)
                  : null,
              wasted: false,
            },
            { new: true },
          )
            .then((newItem) => {
              // update the old item with the previous results
              Item.findByIdAndUpdate(prevResults._id, {
                $decr: { cost: prevResults.costPer * req.body.quantity },
              });
              // If the new item exists update it otherwise create one.
              if (newItem) {
                return Item.findByIdAndUpdate(
                  newItem._id,
                  {
                    $inc: {
                      quantity: req.body.quantity,
                      cost: prevResults.costPer * req.body.quantity,
                    },
                    $push: {
                      notes: {
                        quantity: req.body.quantity,
                        typeOfMovement: 'Transfered to',
                        message: `Transfered in ${req.body.quantity} here on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
                      },
                      poNums: newItem.poNums,
                    },
                  },
                  { new: true },
                )
                  .then((results) => {
                    Item.findByIdAndUpdate(
                      results._id,
                      { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 },
                      { new: true },
                    )
                      .then((result) => res.status(201).send(result))
                      .catch((errors) => res.status(500).send(errors));
                  })
                  .catch((errors) => res.status(500).send(errors));
              }
              const data = {
                quantity: req.body.quantity,
                poNums: [req.body.poNum],
                cost: prevResults.costPer * req.body.quantity,
                inventoryItemType: prevResults.inventoryItemType || req.body.typeID,
                wasted: false,
                project: mongoose.Types.ObjectId(req.params.projectId),
                wbs:
                  req.params.wbsId && req.params.wbsId !== 'Unassigned'
                    ? mongoose.Types.ObjectId(req.params.wbsId)
                    : null,
                notes: [
                  {
                    quantity: req.body.quantity,
                    typeOfMovement: 'Purchased',
                    message: `Tra ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
                  },
                ],
                created: Date.now(),
              };
              const inventoryItem = new Item(data);

              return inventoryItem
                .save()
                .then((results) => res.status(201).send({ from: prevResults, to: results }))
                .catch((errors) => res.status(500).send(errors));
            })
            .catch((errors) => res.status(500).send(errors));
        })
        .catch((errors) => res.status(500).send(errors));
    }
    return res
      .status(400)
      .send(
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
      );
  };

  const delInvById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'delInvById'))) {
      return res.status(403).send('You are not authorized to waste inventory.');
    }
    // send result just sending something now to have it work and not break anything
    // Similar to transfer but changing from wasted false to a wasted true item

    const properWaste = await Item.findOne({
      _id: req.params.invId,
      quantity: { $gte: req.body.quantity },
      wasted: false,
    })
      .select('_id')
      .lean();
    if (!properWaste) {
      return res
        .status(400)
        .send(
          'You must send a valid Inventory Id with enough quantity that you requested to be wasted.',
        );
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
      return Item.findByIdAndUpdate(
        req.params.invId,
        {
          $decr: { quantity: req.body.quantity },
          $push: {
            notes: {
              quantity: req.body.quantity,
              typeOfMovement: 'Wasted from',
              message: `Wasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
            },
          },
        },
        { new: true },
      )
        .then((prevResults) => {
          if (!prevResults) {
            return;
          }
          // check if there is a new item that already exists
          Item.findOne(
            {
              project: req.body.projectId,
              wbs:
                req.body.wbsId && req.body.wbsId !== 'Unassigned'
                  ? mongoose.Types.ObjectId(req.body.wbsId)
                  : null,
              wasted: true,
            },
            { new: true },
          )
            .then((newItem) => {
              // update the old item cost with the previous results
              Item.findByIdAndUpdate(prevResults._id, {
                $decr: { cost: prevResults.costPer * req.body.quantity },
              });
              // If the new item exists update it otherwise create one.
              if (newItem) {
                return Item.findByIdAndUpdate(
                  newItem._id,
                  {
                    $inc: {
                      quantity: req.body.quantity,
                      cost: prevResults.costPer * req.body.quantity,
                    },
                    $push: {
                      notes: {
                        quantity: req.body.quantity,
                        typeOfMovement: 'Wasted to',
                        message: `Wasted ${req.body.quantity} here on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
                      },
                      poNums: newItem.poNums,
                    },
                  },
                  { new: true },
                )
                  .then((results) => {
                    Item.findByIdAndUpdate(
                      results._id,
                      { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 },
                      { new: true },
                    )
                      .then((result) => res.status(201).send(result))
                      .catch((errors) => res.status(500).send(errors));
                  })
                  .catch((errors) => res.status(500).send(errors));
              }
              const data = {
                quantity: req.body.quantity,
                poNums: [req.body.poNum],
                cost: prevResults.costPer * req.body.quantity,
                inventoryItemType: prevResults.inventoryItemType || req.body.typeID,
                wasted: true,
                project: mongoose.Types.ObjectId(req.params.projectId),
                wbs:
                  req.body.wbsId && req.body.wbsId !== 'Unassigned'
                    ? mongoose.Types.ObjectId(req.body.wbsId)
                    : null,
                notes: [
                  {
                    quantity: req.body.quantity,
                    typeOfMovement: 'Wasted to',
                    message: `Wasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
                  },
                ],
                created: Date.now(),
              };
              const inventoryItem = new Item(data);

              return inventoryItem
                .save()
                .then((results) => res.status(201).send({ from: prevResults, to: results }))
                .catch((errors) => res.status(500).send(errors));
            })
            .catch((errors) => res.status(500).send(errors));
        })
        .catch((errors) => res.status(500).send(errors));
    }
    return res
      .status(400)
      .send(
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
      );
  };

  const unWasteInvById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'unWasteInvById'))) {
      return res.status(403).send('You are not authorized to unwaste inventory.');
    }
    const properUnWaste = await Item.findOne({
      _id: req.params.invId,
      quantity: { $gte: req.body.quantity },
      wasted: true,
    })
      .select('_id')
      .lean();
    if (!properUnWaste) {
      return res
        .status(400)
        .send(
          'You must send a valid Inventory Id with enough quantity that you requested to be unwasted.',
        );
    }

    const projectExists = await projects.findOne({ _id: req.body.projectId }).select('_id').lean();
    let wbsExists = true;
    if (req.body.wbsId && req.body.wbsId !== 'Unassigned') {
      wbsExists = await wbs.findOne({ _id: req.body.wbsId }).select('_id').lean();
    }

    if (req.body.quantity && req.params.invId && projectExists && wbsExists) {
      return Item.findByIdAndUpdate(
        req.params.invId,
        {
          $decr: { quantity: req.body.quantity },
          $push: {
            notes: {
              quantity: req.body.quantity,
              typeOfMovement: 'UnWasted from',
              message: `UnWasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
            },
          },
        },
        { new: true },
      );
      x.then((prevResults) => {
        if (!prevResults) {
          return;
        }
        // check if there is a new item that already exists
        Item.findOne(
          {
            project: req.body.projectId,
            wbs:
              req.body.wbsId && req.body.wbsId !== 'Unassigned'
                ? mongoose.Types.ObjectId(req.body.wbsId)
                : null,
            wasted: false,
          },
          { new: true },
        )
          .then((newItem) => {
            // update the old item cost with the previous results
            Item.findByIdAndUpdate(prevResults._id, {
              $decr: { cost: prevResults.costPer * req.body.quantity },
            });
            // If the new item exists update it otherwise create one.
            if (newItem) {
              return Item.findByIdAndUpdate(
                newItem._id,
                {
                  $inc: {
                    quantity: req.body.quantity,
                    cost: prevResults.costPer * req.body.quantity,
                  },
                  $push: {
                    notes: {
                      quantity: req.body.quantity,
                      typeOfMovement: 'UnWasted to',
                      message: `UnWasted ${req.body.quantity} here on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
                    },
                    poNums: newItem.poNums,
                  },
                },
                { new: true },
              )
                .then((results) => {
                  Item.findByIdAndUpdate(
                    results._id,
                    { costPer: results.quantity !== 0 ? results.cost / results.quantity : 0 },
                    { new: true },
                  )
                    .then((result) => res.status(201).send(result))
                    .catch((errors) => res.status(500).send(errors));
                })
                .catch((errors) => res.status(500).send(errors));
            }
            const data = {
              quantity: req.body.quantity,
              poNums: [req.body.poNum],
              cost: prevResults.costPer * req.body.quantity,
              inventoryItemType: prevResults.inventoryItemType || req.body.typeID,
              wasted: false,
              project: mongoose.Types.ObjectId(req.body.projectId),
              wbs:
                req.body.wbsId && req.body.wbsId !== 'Unassigned'
                  ? mongoose.Types.ObjectId(req.body.wbsId)
                  : null,
              notes: [
                {
                  quantity: req.body.quantity,
                  typeOfMovement: 'UnWasted to',
                  message: `UnWasted ${req.body.quantity} on ${moment(Date.now()).format('MM/DD/YYYY')} note: ${req.body.notes}`,
                },
              ],
              created: Date.now(),
            };
            const inventoryItem = new Item(data);

            return inventoryItem
              .save()
              .then((results) => res.status(201).send({ from: prevResults, to: results }))
              .catch((errors) => res.status(500).send(errors));
          })
          .catch((errors) => res.status(500).send(errors));
      }).catch((errors) => res.status(500).send(errors));
    }
    return res
      .status(400)
      .send(
        'Valid Project, Quantity and Type Id are necessary as well as valid wbs if sent in and not Unassigned',
      );
  };

  const getInvIdInfo = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'getInvIdInfo'))) {
      return res.status(403).send('You are not authorized to get inventory by id.');
    }
    // req.params.invId
    // Look up an inventory item by id and send back the info as jsong
    // send result just sending something now to have it work and not break anything
    return Item.findById({ _id: req.params.invId })
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  const putInvById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'putInvById'))) {
      return res.status(403).send('You are not authorized to edit inventory by id.');
    }
    const { invId } = req.params;
    try {
      const existing = await Item.findById(invId);
      if (!existing) return res.status(404).send({ error: 'No valid record found' });

      // Ownership comes from the item, not from a nonexistent route parameter.
      const data = {};
      if (req.body.quantity !== undefined) data.quantity = req.body.quantity;
      if (req.body.cost !== undefined) data.cost = req.body.cost;
      if (req.body.poNum !== undefined) data.poNums = [req.body.poNum];
      const typeId = req.body.typeId || req.body.typeID;
      if (typeId) data.inventoryItemType = typeId;
      const quantity = Number(data.quantity ?? existing.quantity);
      const cost = Number(data.cost ?? existing.cost ?? 0);
      data.costPer = quantity !== 0 ? cost / quantity : 0;
      const update = { $set: data };
      if (req.body.notes !== undefined) {
        update.$push = {
          notes: {
            quantity,
            typeOfMovement: 'Edited',
            message: req.body.notes,
            modified: new Date(),
          },
        };
      }
      const record = await Item.findByIdAndUpdate(invId, update, { new: true });
      if (!record) return res.status(404).send({ error: 'No valid record found' });
      await updateProjectInventoryModifiedTime(existing.project);
      return res.status(200).send({ message: 'Inventory successfully updated' });
    } catch (error) {
      return res.status(500).send({ error: 'An internal error occurred' });
    }
  };

  const getInvTypeById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'getInvTypeById'))) {
      return res.status(403).send('You are not authorized to get inv type by id.');
    }
    // send result just sending something now to have it work and not break anything
    // Use model ItemType and return the find by Id
    return ItemType.findById({ _id: req.params.typeId })
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  const putInvType = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'putInvType'))) {
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

  const getAllInvType = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'getAllInvType'))) {
      return res.status(403).send('You are not authorized to get all inventory.');
    }
    // send result just sending something now to have it work and not break anything
    return ItemType.find({})
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send(error));
  };

  const postInvType = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'postInvType'))) {
      return res.status(403).send('You are not authorized to save an inventory type.');
    }
    return ItemType.find({ name: { $regex: escapeRegex(req.body.name), $options: 'i' } }).then(
      (result) => {
        if (result.length > 0) {
          res.status(400).send({
            error: `Another ItemType with name ${req.body.name} already exists. Sorry, but item names should be like snowflakes, no two should be the same.`,
          });
          return;
        }
        const itemType = new ItemType();

        itemType.type = req.body.type;
        itemType.name = req.body.name;
        itemType.description = req.body.description;
        itemType.uom = req.body.uom;
        itemType.totalStock = req.body.totalStock;
        itemType.totalAvailable = req.body.totalAvailable;
        itemType.projectsUsing = [];
        itemType.imageUrl = req.body.imageUrl || req.body.imageURL;
        itemType.link = req.body.link;

        itemType
          .save()
          .then((results) => res.status(201).send(results))
          .catch((errors) => res.status(500).send(errors));
      },
    );
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
