// const mongoose = require('mongoose');
const AIPrompt = require('../models/weeklySummaryAIPrompt');
const { mockReq, mockRes, assertResMock } = require('../test');
const UserProfile = require('../models/userProfile');

jest.mock('../helpers/dashboardhelper');
const dashboardHelperClosure = require('../helpers/dashboardhelper');
const dashBoardController = require('./dashBoardController');

// mock the cache function before importing so we can manipulate the implementation
// jest.mock('../utilities/nodeCache');
// const cache = require('../utilities/nodeCache');
const makeSut = () => {
  const { 
    updateCopiedPrompt,
    getPromptCopiedDate, 
    updateAIPrompt, 
    getAIPrompt,
    monthlydata,
    weeklydata
  } = dashBoardController(AIPrompt);
  return { 
    updateCopiedPrompt,
    getPromptCopiedDate,
    updateAIPrompt,
    getAIPrompt,
    monthlydata,
    weeklydata
  };
};


const flushPromises = async () => new Promise(setImmediate);

describe('Dashboard Controller tests', () => {
  beforeAll(() => {
    const dashboardHelperObject = 
      {
        laborthisweek: jest.fn(() => Promise.resolve([]))
      };
    dashboardHelperClosure.mockImplementation(() => dashboardHelperObject);
  });
  beforeEach(() => {
    // mockReq.params.userId = '5a7ccd20fde60f1f1857ba16';
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  const error = new Error('any error');


  describe('updateCopiedPrompt Tests', () => {
    test('Returns error 500 if the error occurs in the file update function', async () => {

      const { updateCopiedPrompt } = makeSut();
      
      jest
        .spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() =>
          Promise.reject(new Error('Error Occured in the findOneAndUpdate function')),
        );

      const response = await updateCopiedPrompt(mockReq, mockRes);

      assertResMock(
        500,
        new Error('Error Occured in the findOneAndUpdate function'),
        response,
        mockRes,
      );
    });

    test('Returns error 404 if the user is not found', async () => {

      const { updateCopiedPrompt } = makeSut();

      jest.
        spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() =>
          Promise.resolve(null)
        );

      const response = await updateCopiedPrompt(mockReq, mockRes);

      assertResMock(
        404,
        { message: "User not found " },
        response,
        mockRes,
      );
    });

    test('Returns 200 if there is no error and user is found', async () => {

      const { updateCopiedPrompt } = makeSut();

      jest
        .spyOn(UserProfile, 'findOneAndUpdate')
        .mockImplementationOnce(() => 
          Promise.resolve("Copied AI prompt")
        );

      const response = await updateCopiedPrompt(mockReq, mockRes);

      assertResMock(
        200,
        "Copied AI prompt",
        response,
        mockRes,
      );
    })

  });

  // describe('getPromptCopiedDate', () => {
  //   test('Returns 200 if there is a user and return copied AI prompt',async () => {
  //     const { getPromptCopiedDate } = makeSut();

  //     jest
  //       .spyOn(UserProfile, 'findOne')
  //       .mockImplementationOnce(() =>
  //         Promise.resolve({})
  //       );

  //     const response = getPromptCopiedDate(mockReq, mockRes);

  //     await flushPromises();

  //     assertResMock(
  //       200,
  //       {},
  //       response,
  //       mockRes,
  //     );
  //   })
  // })

  describe('updateAIPrompt Tests', () => {
    test('Returns error 500 if the error occurs in the AI Prompt function', async () => {
      const newRequest = {
        ...mockReq,
        body: {
          requestor: {
            role: 'Owner'
          }
        }
      };

      const { updateAIPrompt } = makeSut();

      jest
        .spyOn(AIPrompt, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.reject(error));

      const response = updateAIPrompt(newRequest, mockRes);

      await flushPromises();

      assertResMock(
        500,
        error,
        response,
        mockRes,
      );
    });

    test('Returns 200 if there is no error and AI Prompt is saved', async () => {
      const newRequest = {
        ...mockReq,
        body: {
          requestor: {
            role: 'Owner'
          }
        }
      };

      const { updateAIPrompt } = makeSut();

      jest
        .spyOn(AIPrompt, 'findOneAndUpdate')
        .mockImplementationOnce(() => Promise.resolve("Successfully saved AI prompt."));

      const response = updateAIPrompt(newRequest, mockRes);

      await flushPromises();

      assertResMock(
        200,
        "Successfully saved AI prompt.",
        response,
        mockRes,
      );
    });

    test('Returns undefined if requestor role is not an owner', () => {
      const newRequest = {
        ...mockReq,
        body: {
          requestor: {
            role: 'Administrator'
          }
        }
      };
      const { updateAIPrompt } = makeSut();

      const mockFindOneAndUpdate = jest
        .spyOn(AIPrompt, 'findOneAndUpdate')
        .mockImplementationOnce(() => 
          Promise.resolve({undefined}),
        );
      
      const response = updateAIPrompt(newRequest, mockRes);

      expect(response).toBeUndefined();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.send).not.toHaveBeenCalled();
      expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
    });

  });

  describe('getAIPrompt Tests', () => {
    
    test('Returns 200 if the GPT exists and send the results back', async () => {

      const { getAIPrompt } = makeSut();

      jest
        .spyOn(AIPrompt,'findById')
        .mockImplementationOnce(() => Promise.resolve({}))

      const response = getAIPrompt(mockReq, mockRes);

      await flushPromises();

      assertResMock(
        200,
        {},
        response,
        mockRes,
      )
    });

    test('Returns 200 if there is no error and new GPT Prompt is created', async () => {

      const { getAIPrompt } = makeSut();

      jest
        .spyOn(AIPrompt, 'findById')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(AIPrompt, 'create')
        .mockImplementationOnce(() => Promise.resolve({}));

      const response = getAIPrompt(mockReq, mockRes);

      await flushPromises();

      assertResMock(
        200, 
        {}, 
        response, 
        mockRes,
        )
    });

    test('Returns 500 if GPT Prompt does not exist', async () => {

      const { getAIPrompt } = makeSut();
      const errorMessage = 'GPT Prompt does not exist';

      jest
        .spyOn(AIPrompt, 'findById')
        .mockRejectedValueOnce(new Error(errorMessage));

      const response = getAIPrompt(mockReq, mockRes);

      await flushPromises();

      assertResMock(
        500,
        new Error(errorMessage),
        response,
        mockRes,
      );
    });

    test('Returns 500 if there is an error in creating the GPT Prompt', async () => {

      const { getAIPrompt } = makeSut();
      const errorMessage = 'Error in creating the GPT Prompt';

      jest
        .spyOn(AIPrompt, 'findById')
        .mockResolvedValueOnce(null);

      jest
        .spyOn(AIPrompt, 'create')
        .mockRejectedValueOnce(new Error(errorMessage));

      const response = getAIPrompt(mockReq, mockRes);

      await flushPromises();

      assertResMock(
        500,
        new Error(errorMessage),
        response,
        mockRes,
      );
    }); 

  });

  describe('weeklydata Tests', () => {

    test('Returns 200 if there is no error and labordata is found', async () => {
      const dashboardHelperObject = 
      {
        laborthisweek: jest.fn(() => Promise.resolve([]))
      };

      dashboardHelperClosure.mockImplementationOnce(() => dashboardHelperObject);

      const { weeklydata } = makeSut();

      const response = weeklydata(mockReq, mockRes);

      await flushPromises();

      assertResMock(
        200,
        [],
        response,
        mockRes,
      );
    })
  })

  describe('monthlydata Tests', () => {

    test('Returns 200 if there is no results and return empty results', async () => {
      const dashboardHelperObject = {
        laborthismonth: jest.fn(() => Promise.resolve([{
          projectName: "",
          timeSpent_hrs: 0,
      }]))
      };

      dashboardHelperClosure.mockImplementationOnce(() => dashboardHelperObject);

      const { monthlydata } = makeSut();

      const response = monthlydata(mockReq, mockRes);

      await flushPromises();

      assertResMock(
        200,
        [{
            projectName: "",
            timeSpent_hrs: 0,
        }],
        response,
        mockRes,
      );
    })

    test('Returns 200 if there is results and return results', async () => {
      const dashboardHelperObject = {
        laborthismonth: jest.fn(() => Promise.resolve({}))
      };

      dashboardHelperClosure.mockImplementationOnce(() => dashboardHelperObject);

      const { monthlydata } = makeSut();

      const response = monthlydata(mockReq, mockRes);

      await flushPromises();

      assertResMock(
        200,
        {},
        response,
        mockRes,
      );
    })

  })
  

  
});
