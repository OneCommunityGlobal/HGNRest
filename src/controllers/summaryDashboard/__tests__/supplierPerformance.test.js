const mongoose = require('mongoose');
const Project = require('../../../models/bmdashboard/buildingProject');
const BuildingMaterial = require('../../../models/bmdashboard/buildingMaterial');
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

    jest.spyOn(BuildingMaterial, 'aggregate').mockResolvedValue([]);
    jest.spyOn(BuildingMaterial, 'distinct').mockResolvedValue([]);
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
      expect(BuildingMaterial.aggregate).not.toHaveBeenCalled();
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
      expect(BuildingMaterial.aggregate).not.toHaveBeenCalled();
    });

    it('returns aggregated supplier data for all projects', async () => {
      const data = [
        {
          supplierName: 'Supplier A',
          onTimeDeliveryPercentage: 95.8,
        },
      ];

      BuildingMaterial.aggregate.mockResolvedValue(data);

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

      const pipeline = BuildingMaterial.aggregate.mock.calls[0][0];

      expect(pipeline[0].$match).toEqual({});

      expect(pipeline[1]).toEqual({
        $unwind: '$purchaseRecord',
      });

      expect(pipeline[2].$match).toEqual({
        'purchaseRecord.status': 'Received',
        'purchaseRecord.supplier': { $type: 'objectId' },
        'purchaseRecord.expectedDeliveryDate': { $type: 'date' },
        'purchaseRecord.actualDeliveryDate': {
          $gte: new Date('2026-01-01T00:00:00.000Z'),
          $lte: new Date('2026-01-31T23:59:59.999Z'),
        },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(data);
    });

    it('filters supplier data by a specific project ID', async () => {
      BuildingMaterial.aggregate.mockResolvedValue([]);

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

      const pipeline = BuildingMaterial.aggregate.mock.calls[0][0];

      expect(String(pipeline[0].$match.project)).toBe(projectId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([]);
    });

    it('handles aggregation failures', async () => {
      BuildingMaterial.aggregate.mockRejectedValue(new Error('Aggregation failed'));

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
    it('returns building project names for projects with supplier deliveries', async () => {
      BuildingMaterial.distinct.mockResolvedValue([new mongoose.Types.ObjectId(projectId)]);

      const query = {
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(projectId),
            name: 'Building 3',
          },
        ]),
      };

      Project.find.mockReturnValue(query);

      const res = makeResponse();

      await controller.getProjectsWithSupplierData({}, res);

      expect(BuildingMaterial.distinct).toHaveBeenCalledWith('project', {
        purchaseRecord: {
          $elemMatch: {
            status: 'Received',
            supplier: { $type: 'objectId' },
            expectedDeliveryDate: { $type: 'date' },
            actualDeliveryDate: { $type: 'date' },
          },
        },
      });

      expect(Project.find).toHaveBeenCalledWith({
        _id: { $in: [new mongoose.Types.ObjectId(projectId)] },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([
        {
          _id: new mongoose.Types.ObjectId(projectId),
          projectName: 'Building 3',
        },
      ]);
    });

    it('returns an empty array when there are no project IDs', async () => {
      BuildingMaterial.distinct.mockResolvedValue([]);

      Project.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      const res = makeResponse();

      await controller.getProjectsWithSupplierData({}, res);

      expect(Project.find).toHaveBeenCalledWith({
        _id: { $in: [] },
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([]);
    });

    it('uses a fallback name for unnamed building projects', async () => {
      const buildingProjectId = new mongoose.Types.ObjectId(projectId);

      BuildingMaterial.distinct.mockResolvedValue([buildingProjectId]);

      Project.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: buildingProjectId,
            name: '',
          },
        ]),
      });

      const res = makeResponse();

      await controller.getProjectsWithSupplierData({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([
        {
          _id: buildingProjectId,
          projectName: 'Unnamed Project',
        },
      ]);
    });

    it('handles project lookup failures', async () => {
      BuildingMaterial.distinct.mockRejectedValue(new Error('Lookup failed'));

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
