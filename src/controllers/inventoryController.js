const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');

const inventoryController = function (Item, ItemType) {
// inventoryRouter.route('/inv/:projectId/wbs/:wbsId') //All By Project seperated into WBS (wbs can be nill which is the unassigned category)
  //   .get(controller.getAllInvInProjectWBS)
  //   .post(controller.postInvInProjectWBS); //Can create a new inventory item in a project with a specified wbs
  const getAllInvInProjectWBS = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const postInvInProjectWBS = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };


  // inventoryRouter.route('/inv/:projectId') //All By Project seperated into WBS (wbs can be nill which is the unassigned category)
  //   .get(controller.getAllInvInProject)
  //   .post(controller.postInvInProject); //Can create a new inventory item in a project with unassigned wbs
  const getAllInvInProject = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const postInvInProject = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  // inventoryRouter.route('/invtransfer/:invId') //Transfer some or all of the inventory to another project/wbs
  //   .put(controller.transferInvById);
  const transferInvById = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };


  // inventoryRouter.route('/invwaste/:invId') //Waste some or all of the inventory
  //   .delete(controller.delInvById);
  const delInvById = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  // inventoryRouter.route('/inv/:invId') //Single Inventory By Inv ID
  //   .get(controller.getInvIdInfo)
  //   .put(controller.putInvById);
  const getInvIdInfo = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const putInvById = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };


  //   inventoryRouter.route('/invtype/:typeId')
  //   .get(controller.getInvTypeById)
  //   .put(controller.putInvType);
  const getInvTypeById = function (req, res) {
    // send result just sending something now to have it work and not break anything
    res.send('Success');
  };

  const putInvType = function (req, res) {
    // send result just sending something now to have it work and not break anything
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
  };
};

module.exports = inventoryController;
