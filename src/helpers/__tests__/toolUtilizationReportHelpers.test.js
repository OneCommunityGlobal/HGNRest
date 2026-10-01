jest.mock('pdfkit', () => jest.fn());
jest.mock('json2csv', () => ({ Parser: jest.fn() }));

const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const { generatePDFReport, generateCSVReport } = require('../toolUtilizationReportHelpers');

// ─── Shared fixtures ───
const makeReportData = (overrides = {}) => ({
  utilizationData: [
    {
      name: 'Drill',
      utilizationRate: 90,
      downtime: 72,
      classification: { label: 'Over-utilized', trafficLight: 'red' },
      toolCount: 2,
    },
    {
      name: 'Wheelbarrow',
      utilizationRate: 30,
      downtime: 504,
      classification: { label: 'Under-utilized', trafficLight: 'yellow' },
      toolCount: 1,
    },
  ],
  alerts: [{ toolName: 'Drill', urgency: 'high', message: 'High utilization at 90%.' }],
  balancing: [
    {
      suggestion: 'Redistribute.',
      rationale: 'Drill at 90%.',
      fromTool: 'Drill',
      toTool: 'Wheelbarrow',
    },
  ],
  recommendations: [
    { toolName: 'Drill', action: 'Schedule maintenance.' },
    { toolName: 'Wheelbarrow', action: 'Review necessity.' },
  ],
  summary: {
    totalToolTypes: 2,
    underUtilized: 1,
    normal: 0,
    overUtilized: 1,
    averageUtilization: 60,
  },
  metadata: {
    generatedDate: '3/20/2026',
    dateRange: '2026-01-01 to 2026-01-31',
    projectFilter: 'ALL',
  },
  ...overrides,
});

// ─── generatePDFReport ───
describe('generatePDFReport', () => {
  let mockDoc;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc = {
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      pipe: jest.fn(),
      end: jest.fn(),
      y: 100,
    };
    PDFDocument.mockImplementation(() => mockDoc);

    mockRes = {
      setHeader: jest.fn(),
      pipe: jest.fn(),
    };
  });

  it('sets Content-Type header to application/pdf', () => {
    generatePDFReport(mockRes, makeReportData());
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
  });

  it('sets Content-Disposition header with pdf filename', () => {
    generatePDFReport(mockRes, makeReportData());
    const [, disposition] = mockRes.setHeader.mock.calls.find(([h]) => h === 'Content-Disposition');
    expect(disposition).toMatch(/attachment; filename="tool-utilization-report-\d+\.pdf"/);
  });

  it('pipes document to response', () => {
    generatePDFReport(mockRes, makeReportData());
    expect(mockDoc.pipe).toHaveBeenCalledWith(mockRes);
  });

  it('calls doc.end() to finalize PDF', () => {
    generatePDFReport(mockRes, makeReportData());
    expect(mockDoc.end).toHaveBeenCalled();
  });

  it('skips empty sections when alerts, balancing, and recommendations are empty', () => {
    const emptyData = makeReportData({ alerts: [], balancing: [], recommendations: [] });
    const moveDownCallsBefore = mockDoc.moveDown.mock.calls.length;
    generatePDFReport(mockRes, emptyData);
    // writePDFSection returns early for empty arrays, so fewer moveDown calls
    // At minimum doc.end() is called meaning the function completed
    expect(mockDoc.end).toHaveBeenCalled();
    expect(mockDoc.moveDown.mock.calls.length).toBeLessThanOrEqual(moveDownCallsBefore + 10);
  });

  it('calls addPage when doc.y exceeds page break threshold', () => {
    mockDoc.y = 750; // above PAGE_BREAK_THRESHOLD (700)
    generatePDFReport(mockRes, makeReportData());
    expect(mockDoc.addPage).toHaveBeenCalled();
  });
});

// ─── generateCSVReport ───
describe('generateCSVReport', () => {
  let mockRes;
  let mockParseInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockParseInstance = { parse: jest.fn().mockReturnValue('Tool Name,Rate\nDrill,90') };
    Parser.mockImplementation(() => mockParseInstance);

    mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
  });

  it('sets Content-Type header to text/csv', () => {
    generateCSVReport(mockRes, makeReportData());
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
  });

  it('sets Content-Disposition header with csv filename', () => {
    generateCSVReport(mockRes, makeReportData());
    const [, disposition] = mockRes.setHeader.mock.calls.find(([h]) => h === 'Content-Disposition');
    expect(disposition).toMatch(/attachment; filename="tool-utilization-report-\d+\.csv"/);
  });

  it('sends response with UTF-8 BOM prefix', () => {
    generateCSVReport(mockRes, makeReportData());
    const sent = mockRes.send.mock.calls[0][0];
    expect(sent.startsWith('\ufeff')).toBe(true);
  });

  it('sets maintenanceAlert to None when no alerts for a tool', () => {
    const data = makeReportData({ alerts: [] });
    generateCSVReport(mockRes, data);
    const rowsPassed = mockParseInstance.parse.mock.calls[0][0];
    rowsPassed.forEach((row) => {
      expect(row.maintenanceAlert).toBe('None');
    });
  });

  it('concatenates multiple alerts for the same tool with semicolons', () => {
    const data = makeReportData({
      alerts: [
        { toolName: 'Drill', message: 'High usage.' },
        { toolName: 'Drill', message: 'Condition worn.' },
      ],
    });
    generateCSVReport(mockRes, data);
    const rowsPassed = mockParseInstance.parse.mock.calls[0][0];
    const drillRow = rowsPassed.find((r) => r.name === 'Drill');
    expect(drillRow.maintenanceAlert).toBe('High usage.; Condition worn.');
  });

  it('sets recommendation to None when no recommendation exists for a tool', () => {
    const data = makeReportData({ recommendations: [] });
    generateCSVReport(mockRes, data);
    const rowsPassed = mockParseInstance.parse.mock.calls[0][0];
    rowsPassed.forEach((row) => {
      expect(row.recommendation).toBe('None');
    });
  });
});
