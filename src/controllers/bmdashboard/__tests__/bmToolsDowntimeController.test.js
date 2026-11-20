const ToolsDowntime = require('../../../models/bmdashboard/toolsDowntime');
const bmToolsDowntimeController = require('../bmToolsDowntimeController');

const recordId = '65419e61105441587e2dec99';

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

// find() is called as find(filter).sort(...).exec(), so return a chain that resolves to rows
const mockFindChain = (result) => {
  const exec = jest.fn();
  if (result instanceof Error) exec.mockRejectedValue(result);
  else exec.mockResolvedValue(result);
  const sort = jest.fn().mockReturnValue({ exec });
  ToolsDowntime.find.mockReturnValue({ sort });
  return { sort, exec };
};

const validBody = () => ({
  toolId: 'tool-1',
  toolName: 'Drill',
  projectId: 'project-1',
  utilizationRate: 75,
  downtimeHours: 4,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
});

describe('bmToolsDowntimeController', () => {
  let controller;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(ToolsDowntime, 'find');
    jest.spyOn(ToolsDowntime, 'findById');
    jest.spyOn(ToolsDowntime, 'findByIdAndUpdate');
    jest.spyOn(ToolsDowntime, 'findByIdAndDelete');
    jest.spyOn(ToolsDowntime, 'aggregate');
    controller = bmToolsDowntimeController();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchAllToolsDowntime', () => {
    it('returns every record, newest first, with a count', async () => {
      const rows = [{ toolName: 'Drill' }, { toolName: 'Saw' }];
      const { sort } = mockFindChain(rows);
      const res = makeResponse();

      await controller.fetchAllToolsDowntime({ query: {} }, res);

      expect(ToolsDowntime.find).toHaveBeenCalledWith({});
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: rows, count: 2 });
    });

    it('filters by tool and project', async () => {
      mockFindChain([]);
      const res = makeResponse();

      await controller.fetchAllToolsDowntime(
        { query: { toolId: 'tool-1', projectId: 'project-1' } },
        res,
      );

      expect(ToolsDowntime.find).toHaveBeenCalledWith({ toolId: 'tool-1', projectId: 'project-1' });
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [], count: 0 });
    });

    it('keeps records that overlap the range when both dates are given', async () => {
      mockFindChain([]);

      await controller.fetchAllToolsDowntime(
        { query: { startDate: '2026-01-01', endDate: '2026-01-31' } },
        makeResponse(),
      );

      expect(ToolsDowntime.find).toHaveBeenCalledWith({
        $or: [
          {
            startDate: { $lte: new Date('2026-01-31') },
            endDate: { $gte: new Date('2026-01-01') },
          },
        ],
      });
    });

    it('keeps records ending on or after the start date when only startDate is given', async () => {
      mockFindChain([]);

      await controller.fetchAllToolsDowntime(
        { query: { startDate: '2026-01-01' } },
        makeResponse(),
      );

      expect(ToolsDowntime.find).toHaveBeenCalledWith({
        endDate: { $gte: new Date('2026-01-01') },
      });
    });

    it('keeps records starting on or before the end date when only endDate is given', async () => {
      mockFindChain([]);

      await controller.fetchAllToolsDowntime({ query: { endDate: '2026-01-31' } }, makeResponse());

      expect(ToolsDowntime.find).toHaveBeenCalledWith({
        startDate: { $lte: new Date('2026-01-31') },
      });
    });

    it('returns 500 when the database query fails', async () => {
      mockFindChain(new Error('db down'));
      const res = makeResponse();

      await controller.fetchAllToolsDowntime({ query: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error occurred while fetching tools downtime records: db down',
      });
    });
  });

  describe('fetchSingleToolsDowntime', () => {
    it('returns 400 for an invalid ID without querying', async () => {
      const res = makeResponse();

      await controller.fetchSingleToolsDowntime({ params: { id: 'not-an-id' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid tools downtime record ID',
      });
      expect(ToolsDowntime.findById).not.toHaveBeenCalled();
    });

    it('returns 404 when the record does not exist', async () => {
      ToolsDowntime.findById.mockResolvedValue(null);
      const res = makeResponse();

      await controller.fetchSingleToolsDowntime({ params: { id: recordId } }, res);

      expect(ToolsDowntime.findById).toHaveBeenCalledWith(recordId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tools downtime record not found',
      });
    });

    it('returns the record when found', async () => {
      const record = { _id: recordId, toolName: 'Drill' };
      ToolsDowntime.findById.mockResolvedValue(record);
      const res = makeResponse();

      await controller.fetchSingleToolsDowntime({ params: { id: recordId } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: record });
    });

    it('returns 500 when the lookup fails', async () => {
      ToolsDowntime.findById.mockRejectedValue(new Error('db down'));
      const res = makeResponse();

      await controller.fetchSingleToolsDowntime({ params: { id: recordId } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error occurred while fetching tools downtime record: db down',
      });
    });
  });

  describe('createToolsDowntime', () => {
    it.each([
      'toolId',
      'toolName',
      'projectId',
      'utilizationRate',
      'downtimeHours',
      'startDate',
      'endDate',
    ])('returns 400 when %s is missing', async (field) => {
      const body = validBody();
      delete body[field];
      const save = jest.spyOn(ToolsDowntime.prototype, 'save');
      const res = makeResponse();

      await controller.createToolsDowntime({ body }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          'Missing required fields: toolId, toolName, projectId, utilizationRate, downtimeHours, startDate, endDate',
      });
      expect(save).not.toHaveBeenCalled();
    });

    it('accepts zero for utilization rate and downtime hours', async () => {
      jest.spyOn(ToolsDowntime.prototype, 'save').mockImplementation(function save() {
        return Promise.resolve(this);
      });
      const res = makeResponse();

      await controller.createToolsDowntime(
        { body: { ...validBody(), utilizationRate: 0, downtimeHours: 0 } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it.each([-1, 101])('returns 400 when utilization rate is %s', async (utilizationRate) => {
      const res = makeResponse();

      await controller.createToolsDowntime({ body: { ...validBody(), utilizationRate } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilization rate must be between 0 and 100',
      });
    });

    it('returns 400 when downtime hours are negative', async () => {
      const res = makeResponse();

      await controller.createToolsDowntime({ body: { ...validBody(), downtimeHours: -2 } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Downtime hours must be a positive number',
      });
    });

    it.each([
      ['startDate', 'not-a-date'],
      ['endDate', 'not-a-date'],
    ])('returns 400 when %s is not a valid date', async (field, value) => {
      const res = makeResponse();

      await controller.createToolsDowntime({ body: { ...validBody(), [field]: value } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid date format for startDate or endDate',
      });
    });

    it.each([
      ['after', '2026-02-01'],
      ['the same as', '2026-01-31'],
    ])('returns 400 when startDate is %s endDate', async (_label, startDate) => {
      const res = makeResponse();

      await controller.createToolsDowntime({ body: { ...validBody(), startDate } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'startDate must be before endDate',
      });
    });

    it('saves the record with Date objects and returns 201', async () => {
      const save = jest.spyOn(ToolsDowntime.prototype, 'save').mockImplementation(function save() {
        return Promise.resolve(this);
      });
      const res = makeResponse();

      await controller.createToolsDowntime({ body: validBody() }, res);

      expect(save).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(201);
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Tools downtime record created successfully');
      expect(payload.data).toMatchObject({
        toolId: 'tool-1',
        toolName: 'Drill',
        projectId: 'project-1',
        utilizationRate: 75,
        downtimeHours: 4,
      });
      expect(payload.data.startDate).toEqual(new Date('2026-01-01'));
      expect(payload.data.endDate).toEqual(new Date('2026-01-31'));
    });

    it('returns 500 when saving fails', async () => {
      jest.spyOn(ToolsDowntime.prototype, 'save').mockRejectedValue(new Error('write failed'));
      const res = makeResponse();

      await controller.createToolsDowntime({ body: validBody() }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error occurred while creating tools downtime record: write failed',
      });
    });
  });

  describe('updateToolsDowntime', () => {
    it('returns 400 for an invalid ID without updating', async () => {
      const res = makeResponse();

      await controller.updateToolsDowntime({ params: { id: 'bad' }, body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid tools downtime record ID',
      });
      expect(ToolsDowntime.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it.each([-5, 150])('returns 400 when utilization rate is %s', async (utilizationRate) => {
      const res = makeResponse();

      await controller.updateToolsDowntime(
        { params: { id: recordId }, body: { utilizationRate } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilization rate must be between 0 and 100',
      });
      expect(ToolsDowntime.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('returns 400 when downtime hours are negative', async () => {
      const res = makeResponse();

      await controller.updateToolsDowntime(
        { params: { id: recordId }, body: { downtimeHours: -1 } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Downtime hours must be a positive number',
      });
    });

    it('returns 404 when the record does not exist', async () => {
      ToolsDowntime.findByIdAndUpdate.mockResolvedValue(null);
      const res = makeResponse();

      await controller.updateToolsDowntime(
        { params: { id: recordId }, body: { toolName: 'Saw' } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tools downtime record not found',
      });
    });

    it('updates with validators on and returns the new record', async () => {
      const updated = { _id: recordId, toolName: 'Saw', utilizationRate: 50 };
      ToolsDowntime.findByIdAndUpdate.mockResolvedValue(updated);
      const body = { toolName: 'Saw', utilizationRate: 50 };
      const res = makeResponse();

      await controller.updateToolsDowntime({ params: { id: recordId }, body }, res);

      expect(ToolsDowntime.findByIdAndUpdate).toHaveBeenCalledWith(recordId, body, {
        new: true,
        runValidators: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updated,
        message: 'Tools downtime record updated successfully',
      });
    });

    it('returns 500 when the update fails', async () => {
      ToolsDowntime.findByIdAndUpdate.mockRejectedValue(new Error('write failed'));
      const res = makeResponse();

      await controller.updateToolsDowntime({ params: { id: recordId }, body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error occurred while updating tools downtime record: write failed',
      });
    });
  });

  describe('deleteToolsDowntime', () => {
    it('returns 400 for an invalid ID without deleting', async () => {
      const res = makeResponse();

      await controller.deleteToolsDowntime({ params: { id: 'bad' } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(ToolsDowntime.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('returns 404 when the record does not exist', async () => {
      ToolsDowntime.findByIdAndDelete.mockResolvedValue(null);
      const res = makeResponse();

      await controller.deleteToolsDowntime({ params: { id: recordId } }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Tools downtime record not found',
      });
    });

    it('deletes the record and returns 200', async () => {
      ToolsDowntime.findByIdAndDelete.mockResolvedValue({ _id: recordId });
      const res = makeResponse();

      await controller.deleteToolsDowntime({ params: { id: recordId } }, res);

      expect(ToolsDowntime.findByIdAndDelete).toHaveBeenCalledWith(recordId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Tools downtime record deleted successfully',
      });
    });

    it('returns 500 when the delete fails', async () => {
      ToolsDowntime.findByIdAndDelete.mockRejectedValue(new Error('db down'));
      const res = makeResponse();

      await controller.deleteToolsDowntime({ params: { id: recordId } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error occurred while deleting tools downtime record: db down',
      });
    });
  });

  describe.each([
    ['getToolsDowntimeByProject', 'projectId', 'project-1', 'project'],
    ['getToolsDowntimeByTool', 'toolId', 'tool-1', 'tool'],
  ])('%s', (handler, param, value, label) => {
    it(`returns the records for that ${label}, newest first`, async () => {
      const rows = [{ toolName: 'Drill' }];
      const { sort } = mockFindChain(rows);
      const res = makeResponse();

      await controller[handler]({ params: { [param]: value } }, res);

      expect(ToolsDowntime.find).toHaveBeenCalledWith({ [param]: value });
      expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: rows, count: 1 });
    });

    it('returns 500 when the query fails', async () => {
      mockFindChain(new Error('db down'));
      const res = makeResponse();

      await controller[handler]({ params: { [param]: value } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: `Error occurred while fetching tools downtime records for ${label}: db down`,
      });
    });
  });

  describe('getToolsDowntimeStats', () => {
    it('returns the totals and averages from the aggregation', async () => {
      const stats = {
        _id: null,
        totalRecords: 3,
        avgUtilizationRate: 60,
        avgDowntimeHours: 2,
        totalDowntimeHours: 6,
        minUtilizationRate: 40,
        maxUtilizationRate: 80,
      };
      ToolsDowntime.aggregate.mockResolvedValue([stats]);
      const res = makeResponse();

      await controller.getToolsDowntimeStats({}, res);

      const pipeline = ToolsDowntime.aggregate.mock.calls[0][0];
      expect(pipeline[0].$group).toMatchObject({
        _id: null,
        totalRecords: { $sum: 1 },
        avgUtilizationRate: { $avg: '$utilizationRate' },
        totalDowntimeHours: { $sum: '$downtimeHours' },
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: stats });
    });

    it('returns zeros when there are no records', async () => {
      ToolsDowntime.aggregate.mockResolvedValue([]);
      const res = makeResponse();

      await controller.getToolsDowntimeStats({}, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          totalRecords: 0,
          avgUtilizationRate: 0,
          avgDowntimeHours: 0,
          totalDowntimeHours: 0,
          minUtilizationRate: 0,
          maxUtilizationRate: 0,
        },
      });
    });

    it('returns 500 when the aggregation fails', async () => {
      ToolsDowntime.aggregate.mockRejectedValue(new Error('db down'));
      const res = makeResponse();

      await controller.getToolsDowntimeStats({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Error occurred while fetching tools downtime statistics: db down',
      });
    });
  });
});
