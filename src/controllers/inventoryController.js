const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');

const inventoryController = function (Item, ItemType) {
// inventoryRouter.route('/inv/:projectId/wbs/:wbsId') //All By Project seperated into WBS (wbs can be nill which is the unassigned category)
  //   .get(controller.getAllInvInProjectWBS)
  //   .post(controller.postInvInProjectWBS); //Can create a new inventory item in a project with a specified wbs
  const getAllInvInProjectWBS = function (req, res) {
    //use req.params.projectId and wbsId
    //Run a mongo query on the Item model to find all items with both the project and wbs
    //sort the mongo query so that the Wasted false items are listed first
    
    console.log(mongoose, UserProfile, Item, ItemType); // console logging as we need to use it to commit
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const postInvInProjectWBS = function (req, res) {
    //use req.body.projectId and req.body.wbsId req.body.quantity, 
    // req.body.cost, req.body.ponum and req.body.typeId, req.body.message
    // create the item  using that information with cost per quantity being a calculation.
    //  Add a note field with "Created/Purchased" in the typeOfMovement field quantity being the full quantity and message being the req.body.message
    // make sure the item is saved and 
    // send result just sending sucess and any information returned
    res.send('Success');
  };


  // inventoryRouter.route('/inv/:projectId') //All By Project seperated into WBS (wbs can be nill which is the unassigned category)
  //   .get(controller.getAllInvInProject)
  //   .post(controller.postInvInProject); //Can create a new inventory item in a project with unassigned wbs
  const getAllInvInProject = function (req, res) {
    //same as getAllInvInProjectWBS but just using only the project to find the items of inventory
    //this time the list of objects returned should be sorted first by wbs(with null which means unassigned wbs being first) 
    //then inside each wbs have it sorted by the wasted with false being before true
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const postInvInProject = function (req, res) {
    //same as posting an item inProjectWBS but the WBS is uanassigned(i.e. null)
    //but same process
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  // inventoryRouter.route('/invtransfer/:invId') //Transfer some or all of the inventory to another project/wbs
  //   .put(controller.transferInvById);
  const transferInvById = function (req, res) {
    //This function transfer inventory by id
    //req.body.projectId, req.body.message, req.body.quantity and req.body.wbsId(can be null for unassigned)
    // will be the data with req.param.invId
    //identifying the item to move.
    // First check if there is an item with the same type in the destination project/wbs that is not wasted
    // If there is then move the quantity over to that item subtract the cost of that quantity from
    //the past item(take quantity moved * cost per quantity) and add the cost to the new item transfered over
    //Add any PO numbers to the end of the array
    //If no item non wasted item with the same type then create the item just like normal
    //copying over the information such as PO numbers and cost etc
    //create a note with the message in both the new/transfered to and old/transferred from
    //use type transfer
    //If the entire quantity was moved delete the old item.
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };


  // inventoryRouter.route('/invwaste/:invId') //Waste some or all of the inventory
  //  .put(controller.unWasteInvById)
  //   .delete(controller.delInvById);
  const delInvById = function (req, res) {
    // send result just sending something now to have it work and not break anything
    //Similar to transfer but changing from wasted false to a wasted true item
    //first try to find that item in the wasted section of the project/wbs it is in
    // and move it if needed if the entire quanity is used delete it/if the entire quantity is used
    //make sure to update the costs and costs per quantity on both items
    res.send('Success');
  };

  const unWasteInvById = function (req, res) {
    // send result just sending something now to have it work and not break anything
    //Inverse of Wasted /an internal transfer
    res.send('Success');
  };

  // inventoryRouter.route('/inv/:invId') //Single Inventory By Inv ID
  //   .get(controller.getInvIdInfo)
  //   .put(controller.putInvById);
  const getInvIdInfo = function (req, res) {
    //req.params.invId
    //Look up an inventory item by id and send back the info as jsong
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const putInvById = function (req, res) {
    // update the inv by id.
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };


  //   inventoryRouter.route('/invtype/:typeId')
  //   .get(controller.getInvTypeById)
  //   .put(controller.putInvType);
  const getInvTypeById = function (req, res) {
    // send result just sending something now to have it work and not break anything
    // Use model ItemType and return the find by Id
    res.send('Success');
  };

  const putInvType = function (req, res) {
    // send result just sending something now to have it work and not break anything
    //Change an invType
    res.send('Success');
  };

  //   inventoryRouter.route('/invtype')
  //   .get(controller.getAllInvType)
  //   .post(controller.postInvType);
  const getAllInvType = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const postInvType = function (req, res) {
    // send result just sending something now to have it work and not break anything
    //create an inventory type req.body.name, req.body.description, req.body.imageUrl, req.body.quantifier
    res.send('Success');
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
