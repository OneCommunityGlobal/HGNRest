// const mongoose = require('mongoose');
// const Project = require('../models/project');
// const Task = require('../models/task');
// const WBS = require('../models/wbs');
// const wbsController = require('./wbsController');
// const helper = require('../utilities/permissions');
// const { mockReq, mockRes, assertResMock } = require('../test');

// const makeSut = () => {
//   const { getAllWBS } = wbsController(WBS);

//   return { getAllWBS };
// };

// const flushPromises = () => new Promise(setImmediate);

// const mockHasPermission = (value) =>
//   jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));

// describe('Wbs Controller', () => {});

test('random', () => {
  expect(1 + 2).toEqual(3);
});
