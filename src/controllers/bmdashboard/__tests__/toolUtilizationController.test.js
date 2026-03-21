jest.mock('../../../helpers/toolUtilizationHelpers');
jest.mock('../../../helpers/toolUtilizationReportHelpers');
jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));

const {
  computeUtilizationData,
  buildUtilizationResponse,
  generateRecommendations,
  generateMaintenanceAlerts,
  generateResourceBalancingSuggestions,
  buildInsightsSummary,
  buildReportPayload,
} = require('../../../helpers/toolUtilizationHelpers');
const {
  generatePDFReport,
  generateCSVReport,
} = require('../../../helpers/toolUtilizationReportHelpers');
const toolUtilizationController = require('../toolUtilizationController');

// ─── Shared setup ───
const mockBuildingTool = {};
const controller = toolUtilizationController(mockBuildingTool);

const makeReq = (query = {}) => ({ query });
const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
  send: jest.fn(),
  headersSent: false,
});

const mockRangeStart = new Date('2026-01-01');
const mockRangeEnd = new Date('2026-01-31');
const mockUtilizationData = [
  {
    name: 'Drill',
    utilizationRate: 75,
    downtime: 180,
    classification: { label: 'Normal', trafficLight: 'green' },
    toolCount: 1,
    toolGroupDetails: { tools: [], purchaseStatuses: [], conditions: [], currentUsages: [] },
  },
];
const mockReportPayload = {
  utilizationData: mockUtilizationData,
  alerts: [],
  balancing: [],
  recommendations: [],
  summary: {},
  metadata: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  computeUtilizationData.mockResolvedValue({
    utilizationData: mockUtilizationData,
    rangeStart: mockRangeStart,
    rangeEnd: mockRangeEnd,
  });
  buildUtilizationResponse.mockResolvedValue(mockUtilizationData);
  generateRecommendations.mockReturnValue([]);
  generateMaintenanceAlerts.mockReturnValue([]);
  generateResourceBalancingSuggestions.mockReturnValue([]);
  buildInsightsSummary.mockReturnValue({
    totalToolTypes: 1,
    underUtilized: 0,
    normal: 1,
    overUtilized: 0,
    averageUtilization: 75,
  });
  buildReportPayload.mockReturnValue(mockReportPayload);
});

// ─── getUtilization ───
describe('getUtilization', () => {
  it('returns 200 with utilization data when no mode is specified', async () => {
    const req = makeReq({});
    const res = makeRes();

    await controller.getUtilization(req, res);

    expect(computeUtilizationData).toHaveBeenCalledWith(mockBuildingTool, {
      tool: undefined,
      project: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    expect(buildUtilizationResponse).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMode: 'historical' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockUtilizationData);
  });

  it('passes forecast30 mode to buildUtilizationResponse', async () => {
    const req = makeReq({ mode: 'forecast30' });
    const res = makeRes();

    await controller.getUtilization(req, res);

    expect(buildUtilizationResponse).toHaveBeenCalledWith(
      expect.objectContaining({ selectedMode: 'forecast30' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 when mode is invalid', async () => {
    const req = makeReq({ mode: 'badMode' });
    const res = makeRes();

    await controller.getUtilization(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Invalid mode') }),
    );
  });

  it('returns 500 when computeUtilizationData throws', async () => {
    computeUtilizationData.mockRejectedValue(new Error('DB failure'));
    const req = makeReq({});
    const res = makeRes();

    await controller.getUtilization(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('DB failure') }),
    );
  });

  it('returns 500 when buildUtilizationResponse throws', async () => {
    buildUtilizationResponse.mockRejectedValue(new Error('Response build failed'));
    const req = makeReq({});
    const res = makeRes();

    await controller.getUtilization(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── getInsights ───
describe('getInsights', () => {
  it('returns 200 with all insight sections', async () => {
    const recommendations = [{ toolName: 'Drill', action: 'Plan maintenance.' }];
    const alerts = [{ toolName: 'Drill', alertType: 'overuse', message: 'High.', urgency: 'high' }];
    const balancing = [{ suggestion: 'Redistribute.', fromTool: 'Drill', toTool: 'Shovel' }];
    const summary = {
      totalToolTypes: 1,
      underUtilized: 0,
      normal: 0,
      overUtilized: 1,
      averageUtilization: 90,
    };

    generateRecommendations.mockReturnValue(recommendations);
    generateMaintenanceAlerts.mockReturnValue(alerts);
    generateResourceBalancingSuggestions.mockReturnValue(balancing);
    buildInsightsSummary.mockReturnValue(summary);

    const req = makeReq({});
    const res = makeRes();

    await controller.getInsights(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      recommendations,
      maintenanceAlerts: alerts,
      resourceBalancing: balancing,
      summary,
    });
  });

  it('calls all insight helpers with utilizationData from computeUtilizationData', async () => {
    const req = makeReq({});
    const res = makeRes();

    await controller.getInsights(req, res);

    expect(generateRecommendations).toHaveBeenCalledWith(mockUtilizationData);
    expect(generateMaintenanceAlerts).toHaveBeenCalledWith(mockUtilizationData);
    expect(generateResourceBalancingSuggestions).toHaveBeenCalledWith(mockUtilizationData);
    expect(buildInsightsSummary).toHaveBeenCalledWith(mockUtilizationData);
  });

  it('returns 500 when computeUtilizationData throws', async () => {
    computeUtilizationData.mockRejectedValue(new Error('DB error'));
    const req = makeReq({});
    const res = makeRes();

    await controller.getInsights(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('DB error') }),
    );
  });
});

// ─── exportReport ───
describe('exportReport', () => {
  it('returns 400 when format param is missing', async () => {
    const req = makeReq({});
    const res = makeRes();

    await controller.exportReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Invalid format') }),
    );
  });

  it('returns 400 when format is not pdf or csv', async () => {
    const req = makeReq({ format: 'xlsx' });
    const res = makeRes();

    await controller.exportReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls generateCSVReport for csv format', async () => {
    const req = makeReq({ format: 'csv' });
    const res = makeRes();

    await controller.exportReport(req, res);

    expect(generateCSVReport).toHaveBeenCalledWith(res, mockReportPayload);
    expect(generatePDFReport).not.toHaveBeenCalled();
  });

  it('calls generatePDFReport for pdf format', async () => {
    const req = makeReq({ format: 'pdf' });
    const res = makeRes();

    await controller.exportReport(req, res);

    expect(generatePDFReport).toHaveBeenCalledWith(res, mockReportPayload);
    expect(generateCSVReport).not.toHaveBeenCalled();
  });

  it('returns 500 when error occurs and headers are not yet sent', async () => {
    computeUtilizationData.mockRejectedValue(new Error('Export failed'));
    const req = makeReq({ format: 'csv' });
    const res = { ...makeRes(), headersSent: false };

    await controller.exportReport(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Export failed') }),
    );
  });

  it('does not send error response when headers are already sent', async () => {
    computeUtilizationData.mockRejectedValue(new Error('Stream error'));
    const req = makeReq({ format: 'csv' });
    const res = { ...makeRes(), headersSent: true };

    await controller.exportReport(req, res);

    expect(res.status).not.toHaveBeenCalled();
  });
});
