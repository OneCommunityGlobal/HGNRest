const WeeklySummaryEmailAssignmentController = require('./WeeklySummaryEmailAssignmentController');

const makeMockRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
  json: jest.fn(),
});

describe('WeeklySummaryEmailAssignmentController', () => {
  const makeUserProfileQueryMock = (resolvedValue) => ({
    findOne: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        equals: jest.fn().mockResolvedValue(resolvedValue),
      }),
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateWeeklySummaryEmailAssignment', () => {
    it('updates only email when no matching user profile is found for the edited email', async () => {
      const updatedAssignment = {
        _id: 'assignment-id',
        email: 'new@example.com',
        assignedTo: { _id: 'existing-user-id', firstName: 'Existing', lastName: 'User' },
      };
      const populate = jest.fn().mockResolvedValue(updatedAssignment);
      const WeeklySummaryEmailAssignment = {
        findOneAndUpdate: jest.fn().mockReturnValue({ populate }),
      };
      const userProfile = makeUserProfileQueryMock(null);

      const controller = WeeklySummaryEmailAssignmentController(
        WeeklySummaryEmailAssignment,
        userProfile,
      );
      const req = { params: { id: 'assignment-id' }, body: { email: 'new@example.com' } };
      const res = makeMockRes();

      await controller.updateWeeklySummaryEmailAssignment(req, res);

      expect(userProfile.findOne).toHaveBeenCalledWith();
      expect(WeeklySummaryEmailAssignment.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'assignment-id' },
        { email: 'new@example.com' },
        { new: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ assignment: updatedAssignment });
    });

    it('updates both email and assignedTo and returns populated assignment payload', async () => {
      const updatedAssignment = {
        _id: 'assignment-id',
        email: 'updated@example.com',
        assignedTo: { _id: 'user-id', firstName: 'Updated', lastName: 'User' },
      };
      const populate = jest.fn().mockResolvedValue(updatedAssignment);
      const WeeklySummaryEmailAssignment = {
        findOneAndUpdate: jest.fn().mockReturnValue({ populate }),
      };
      const userProfile = makeUserProfileQueryMock({ _id: 'user-id' });

      const controller = WeeklySummaryEmailAssignmentController(
        WeeklySummaryEmailAssignment,
        userProfile,
      );
      const req = { params: { id: 'assignment-id' }, body: { email: 'updated@example.com' } };
      const res = makeMockRes();

      await controller.updateWeeklySummaryEmailAssignment(req, res);

      expect(WeeklySummaryEmailAssignment.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'assignment-id' },
        { email: 'updated@example.com', assignedTo: 'user-id' },
        { new: true },
      );
      expect(populate).toHaveBeenCalledWith('assignedTo');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ assignment: updatedAssignment });
    });

    it('returns 409 when the edited email already exists', async () => {
      const populate = jest.fn().mockRejectedValue({ code: 11000 });
      const WeeklySummaryEmailAssignment = {
        findOneAndUpdate: jest.fn().mockReturnValue({ populate }),
      };
      const userProfile = makeUserProfileQueryMock({ _id: 'user-id' });

      const controller = WeeklySummaryEmailAssignmentController(
        WeeklySummaryEmailAssignment,
        userProfile,
      );
      const req = { params: { id: 'assignment-id' }, body: { email: 'existing@example.com' } };
      const res = makeMockRes();

      await controller.updateWeeklySummaryEmailAssignment(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.send).toHaveBeenCalledWith('Email already assigned');
    });
  });
});
