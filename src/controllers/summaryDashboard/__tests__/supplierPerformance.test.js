const mongoose = require('mongoose');
const Project = require('../../../models/project');
const SupplierPerformance = require('../../../models/summaryDashboard/supplierPerformance');
const logger = require('../../../startup/logger');
const supplierPerformanceController = require('../supplierPerformance');

const projectId = '64acb5d8a5f9ed4ca45d87df';
const missingProjectId = '507f1f77bcf86cd799439011';

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

describe('Supplier Performance Controller', () => {
  let controller;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    jest.spyOn(SupplierPerformance, 'aggregate');
    jest.spyOn(SupplierPerformance, 'distinct');
    jest.spyOn(Project, 'find');
    jest.spyOn(logger, 'logException').mockImplementation(() => {});

    controller = supplierPerformanceController();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSupplierPerformance', () => {
    it('returns 400 when required dates are missing', async () => {
      const res = makeResponse();

      await controller.getSupplierPerformance({ query: { projectId: 'all' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'Missing required query parameters: startDate, endDate',
      );
      expect(SupplierPerformance.aggregate).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid project ID', async () => {
      const res = makeResponse();

      await controller.getSupplierPerformance(
        {
          query: {
            projectId: 'invalid-project',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Invalid projectId.');
      expect(SupplierPerformance.aggregate).not.toHaveBeenCalled();
    });

    it('returns aggregated supplier data for all projects', async () => {
      const data = [
        {
          supplierName: 'Supplier A',
          onTimeDeliveryPercentage: 95.8,
        },
      ];

      SupplierPerformance.aggregate.mockResolvedValue(data);

      const res = makeResponse();

      await controller.getSupplierPerformance(
        {
          query: {
            projectId: 'all',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        },
        res,
      );

      const pipeline = SupplierPerformance.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match).toEqual({
        startDate: { $lte: new Date('2026-01-31') },
        endDate: { $gte: new Date('2026-01-01') },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(data);
    });

    it('filters supplier data by a specific project ID', async () => {
      SupplierPerformance.aggregate.mockResolvedValue([]);

      const res = makeResponse();

      await controller.getSupplierPerformance(
        {
          query: {
            projectId,
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        },
        res,
      );

      const pipeline = SupplierPerformance.aggregate.mock.calls[0][0];

      expect(String(pipeline[0].$match.projectId)).toBe(projectId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([]);
    });

    it('handles aggregation failures', async () => {
      SupplierPerformance.aggregate.mockRejectedValue(new Error('Aggregation failed'));

      const res = makeResponse();

      await controller.getSupplierPerformance(
        {
          query: {
            projectId: 'all',
            startDate: '2026-01-01',
            endDate: '2026-01-31',
          },
        },
        res,
      );

      expect(logger.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        'Error fetching supplier performance data. Please try again.',
      );
    });
  });

  describe('getProjectsWithSupplierData', () => {
    it('returns resolved project names and preserves missing IDs', async () => {
      SupplierPerformance.distinct.mockResolvedValue([
        new mongoose.Types.ObjectId(projectId),
        new mongoose.Types.ObjectId(missingProjectId),
      ]);

      const query = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(projectId),
            projectName: 'SiddharthTest',
          },
        ]),
      };

      Project.find.mockReturnValue(query);

      const res = makeResponse();

      await controller.getProjectsWithSupplierData({}, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const results = res.send.mock.calls[0][0];

      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: new mongoose.Types.ObjectId(projectId),
            projectName: 'SiddharthTest',
          }),
          expect.objectContaining({
            _id: new mongoose.Types.ObjectId(missingProjectId),
            projectName: 'Unknown project (…9011)',
          }),
        ]),
      );

      expect(results).toHaveLength(2);
    });

    it('returns an empty array when there are no project IDs', async () => {
      SupplierPerformance.distinct.mockResolvedValue([]);

      const res = makeResponse();

      await controller.getProjectsWithSupplierData({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([]);
      expect(Project.find).not.toHaveBeenCalled();
    });

    it('ignores malformed project IDs', async () => {
      SupplierPerformance.distinct.mockResolvedValue(['invalid-id']);

      const res = makeResponse();

      await controller.getProjectsWithSupplierData({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([]);
      expect(Project.find).not.toHaveBeenCalled();
    });

    it('handles project lookup failures', async () => {
      SupplierPerformance.distinct.mockRejectedValue(new Error('Lookup failed'));

      const res = makeResponse();

      await controller.getProjectsWithSupplierData({}, res);

      expect(logger.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        'Error fetching projects with supplier data. Please try again.',
      );
    });
  });

  describe('postSupplierPerformance', () => {
    const validBody = {
      supplierName: 'Supplier A',
      onTimeDeliveryPercentage: 95.8,
      projectId,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    };

    it('creates a supplier performance record successfully', async () => {
      const saveSpy = jest.spyOn(SupplierPerformance.prototype, 'save').mockResolvedValue({});

      const res = makeResponse();

      await controller.postSupplierPerformance({ body: validBody }, res);

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.send).toHaveBeenCalledWith('Supplier performance record created successfully.');
    });

    it('returns 400 when required fields are missing', async () => {
      const saveSpy = jest.spyOn(SupplierPerformance.prototype, 'save');

      const res = makeResponse();

      await controller.postSupplierPerformance(
        {
          body: {
            supplierName: 'Supplier A',
            projectId,
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        'All fields are required: supplierName, onTimeDeliveryPercentage, projectId, startDate, endDate',
      );
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('returns 500 when saving a record fails', async () => {
      jest
        .spyOn(SupplierPerformance.prototype, 'save')
        .mockRejectedValue(new Error('Database failure'));

      const res = makeResponse();

      await controller.postSupplierPerformance({ body: validBody }, res);

      expect(logger.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        'Error saving supplier performance data. Please try again.',
      );
    });
  });

  describe('deleteSupplierPerformanceByProject', () => {
    it('deletes supplier records successfully', async () => {
      jest.spyOn(SupplierPerformance, 'deleteMany').mockResolvedValue({
        deletedCount: 2,
      });

      const res = makeResponse();

      await controller.deleteSupplierPerformanceByProject({ params: { projectId } }, res);

      expect(SupplierPerformance.deleteMany).toHaveBeenCalledWith({
        projectId: new mongoose.Types.ObjectId(projectId),
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith('Successfully deleted 2 record(s).');
    });

    it('returns 404 when no matching records exist', async () => {
      jest.spyOn(SupplierPerformance, 'deleteMany').mockResolvedValue({
        deletedCount: 0,
      });

      const res = makeResponse();

      await controller.deleteSupplierPerformanceByProject({ params: { projectId } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('No records found for the specified project.');
    });

    it('returns 400 when project ID is missing', async () => {
      const deleteSpy = jest.spyOn(SupplierPerformance, 'deleteMany');

      const res = makeResponse();

      await controller.deleteSupplierPerformanceByProject({ params: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Project ID is required.');
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('returns 500 when deletion fails', async () => {
      jest
        .spyOn(SupplierPerformance, 'deleteMany')
        .mockRejectedValue(new Error('Database failure'));

      const res = makeResponse();

      await controller.deleteSupplierPerformanceByProject({ params: { projectId } }, res);

      expect(logger.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith(
        'Error deleting supplier performance data. Please try again.',
      );
    });
  });
});
