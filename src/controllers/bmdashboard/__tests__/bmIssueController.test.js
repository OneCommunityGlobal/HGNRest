const bmIssueController = require('../bmIssueController');

describe('bmIssueController', () => {
  let controller;
  let metIssue;
  let injuryIssue;
  let req;
  let res;

  beforeEach(() => {
    // Mock Mongoose‐style model API:
    metIssue = {
      find: jest.fn(),
      create: jest.fn(),
    };
    injuryIssue = {
      find: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    controller = bmIssueController(metIssue, injuryIssue);

    req = { params: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('bmGetMetIssue', () => {
    it('should return 200 and results on success', async () => {
      const items = [{}, {}];
      // Create a chainable query mock
      const mockQuery = {
        then: cb => { cb(items); return mockQuery; },
        catch: () => mockQuery,
      };
      metIssue.find.mockReturnValue({
        populate: () => mockQuery,
      });

      await controller.bmGetMetIssue(req, res);

      expect(metIssue.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(items);
    });

    it('should return 500 on query error', async () => {
      const error = new Error('fail');
      // Chainable query that invokes catch callback
      const mockQuery = {
        then: () => mockQuery,
        catch: cb => { cb(error); return mockQuery; },
      };
      metIssue.find.mockReturnValue({
        populate: () => mockQuery,
      });

      await controller.bmGetMetIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(error);
    });
  });

  describe('bmPostMetIssue', () => {
    it('should return 201 and new doc on success', async () => {
      const newDoc = { foo: 'bar' };
      req.body = newDoc;

      // chainable successful create()
      const mockCreateSuccess = {
        then: cb => { cb(newDoc); return mockCreateSuccess; },
        catch: () => mockCreateSuccess,
      };
      metIssue.create.mockReturnValue(mockCreateSuccess);

      await controller.bmPostMetIssue(req, res);

      expect(metIssue.create).toHaveBeenCalledWith(newDoc);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith(newDoc);
    });

    it('should return 500 on creation error', async () => {
      const error = new Error('oops');

      // chainable failing create()
      const mockCreateFail = {
        then: () => mockCreateFail,
        catch: cb => { cb(error); return mockCreateFail; },
      };
      metIssue.create.mockReturnValue(mockCreateFail);

      await controller.bmPostMetIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(error);
    });
  });


  describe('bmPostInjuryIssue', () => {
    it('should return 201 and new injury issue on success', async () => {
      const doc = { id: 1 };
      req.body = doc;
      injuryIssue.create.mockResolvedValue(doc);

      await controller.bmPostInjuryIssue(req, res);

      expect(injuryIssue.create).toHaveBeenCalledWith(doc);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(doc);
    });

    it('should return 400 and error message on failure', async () => {
      const err = new Error('bad');
      injuryIssue.create.mockRejectedValue(err);

      await controller.bmPostInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: err.message });
    });
  });

  describe('bmGetInjuryIssue', () => {
    it('should return 200 and list on success', async () => {
      const list = [{}, {}];
      injuryIssue.find.mockReturnValue({
        populate: () => Promise.resolve(list),
      });

      await controller.bmGetInjuryIssue(req, res);

      expect(injuryIssue.find).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(list);
    });

    it('should return 500 on error', async () => {
      const err = new Error('err');
      injuryIssue.find.mockReturnValue({
        populate: () => Promise.reject(err),
      });

      await controller.bmGetInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: err.message });
    });
  });

  describe('bmDeleteInjuryIssue', () => {
    it('should return 200 when deletion succeeds', async () => {
      const deleted = { id: 2 };
      req.params.id = '2';
      injuryIssue.findByIdAndDelete.mockResolvedValue(deleted);

      await controller.bmDeleteInjuryIssue(req, res);

      expect(injuryIssue.findByIdAndDelete).toHaveBeenCalledWith('2');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Deleted successfully', deleted });
    });

    it('should return 404 when nothing to delete', async () => {
      injuryIssue.findByIdAndDelete.mockResolvedValue(null);

      await controller.bmDeleteInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Issue not found' });
    });

    it('should return 500 on exception', async () => {
      const err = new Error('fail');
      injuryIssue.findByIdAndDelete.mockRejectedValue(err);

      await controller.bmDeleteInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: err.message });
    });
  });

  describe('bmRenameInjuryIssue', () => {
    it('should return 200 on successful rename', async () => {
      const updated = { id: 3 };
      req.params.id = '3';
      req.body.newName = 'New Name';
      injuryIssue.findByIdAndUpdate.mockResolvedValue(updated);

      await controller.bmRenameInjuryIssue(req, res);

      expect(injuryIssue.findByIdAndUpdate).toHaveBeenCalledWith(
        '3',
        { name: 'New Name' },
        { new: true, runValidators: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Renamed successfully', updated });
    });

    it('should return 400 if newName is missing', async () => {
      req.params.id = '3';
      await controller.bmRenameInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'newName is required' });
    });

    it('should return 404 if nothing updated', async () => {
      req.params.id = '3';
      req.body.newName = 'X';
      injuryIssue.findByIdAndUpdate.mockResolvedValue(null);

      await controller.bmRenameInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Issue not found' });
    });

    it('should return 500 on exception', async () => {
      const err = new Error('err');
      req.params.id = '3';
      req.body.newName = 'X';
      injuryIssue.findByIdAndUpdate.mockRejectedValue(err);

      await controller.bmRenameInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: err.message });
    });
  });

  describe('bmCopyInjuryIssue', () => {
    it('should return 201 and copy on success', async () => {
      const original = { projectId: 1, name: 'A', category: 'C', assignedTo: 5, totalCost: 10 };
      req.params.id = 'x';
      injuryIssue.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(original),
      });
      const copy = { ...original, name: 'A (Copy)' };
      injuryIssue.create.mockResolvedValue(copy);

      await controller.bmCopyInjuryIssue(req, res);

      expect(injuryIssue.findById).toHaveBeenCalledWith('x');
      expect(injuryIssue.create).toHaveBeenCalledWith(expect.objectContaining({
        projectId: 1,
        name: 'A (Copy)',
        category: 'C',
        assignedTo: 5,
        totalCost: 10
      }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Copied successfully', copy });
    });

    it('should return 404 if original missing', async () => {
      injuryIssue.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await controller.bmCopyInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Issue not found' });
    });

    it('should return 500 on exception', async () => {
      injuryIssue.findById.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('err')),
      });

      await controller.bmCopyInjuryIssue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'err' });
    });
  });
});