jest.mock('../services/applicationsService', () => ({
  getMapAnalytics: jest.fn(),
  getComparisonData: jest.fn(),
}));
jest.mock('../utilities/dateRanges', () => ({
  getRangeFromQuery: jest.fn(),
  getPreviousRange: jest.fn(),
  getPreviousCustomRange: jest.fn(),
}));
jest.mock('../utilities/cache', () => ({
  analytics: { get: jest.fn(), set: jest.fn() },
  static: { get: jest.fn(), set: jest.fn() },
}));
jest.mock('../models/application', () => ({ distinct: jest.fn() }));

const { getMapAnalytics, getComparisonData } = require('../services/applicationsService');
const {
  getRangeFromQuery,
  getPreviousRange,
  getPreviousCustomRange,
} = require('../utilities/dateRanges');
const cache = require('../utilities/cache');
const Application = require('../models/application');
const { getCountryApplications, getAvailableRoles } = require('./countryAnalyticsController');

const makeSut = (query = {}) => ({
  req: { query },
  res: { json: jest.fn(), status: jest.fn().mockReturnThis() },
  next: jest.fn(),
});

const range = {
  start: new Date('2026-10-25T00:00:00.000Z'),
  end: new Date('2026-10-31T23:59:59.999Z'),
  type: 'weekly',
};
const previous = {
  start: new Date('2026-10-18T00:00:00.000Z'),
  end: new Date('2026-10-24T23:59:59.999Z'),
  type: 'weekly',
};

describe('countryAnalyticsController', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    getRangeFromQuery.mockReturnValue(range);
    getPreviousRange.mockReturnValue(previous);
    getMapAnalytics.mockResolvedValue([]);
    getComparisonData.mockResolvedValue({ comparisonData: {} });
  });

  afterEach(() => jest.restoreAllMocks());

  describe('getCountryApplications', () => {
    test('defaults to the weekly filter and passes remaining query parameters through', async () => {
      const { req, res, next } = makeSut({ roles: ' Developer, Designer, ,' });
      await getCountryApplications(req, res, next);
      expect(getRangeFromQuery).toHaveBeenCalledWith({
        filter: 'weekly',
        roles: ' Developer, Designer, ,',
      });
      expect(getMapAnalytics).toHaveBeenCalledWith(range, ['Developer', 'Designer'], {
        includeMetadata: false,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('preserves an explicit filter', async () => {
      const { req, res, next } = makeSut({ filter: 'monthly' });
      await getCountryApplications(req, res, next);
      expect(getRangeFromQuery).toHaveBeenCalledWith({ filter: 'monthly' });
    });

    test.each([
      ['week', 'weekly'],
      ['MONTH', 'monthly'],
      ['Year', 'yearly'],
      ['ALL', 'all'],
      ['unknown', 'weekly'],
    ])('maps frontend timeFrame %s to %s', async (timeFrame, filter) => {
      const { req, res, next } = makeSut({ timeFrame, filter: 'yearly' });
      await getCountryApplications(req, res, next);
      expect(getRangeFromQuery).toHaveBeenCalledWith({ timeFrame, filter });
    });

    test.each([undefined, ''])('treats missing/empty roles as unrestricted: %p', async (roles) => {
      const { req, res, next } = makeSut({ roles });
      await getCountryApplications(req, res, next);
      expect(getMapAnalytics).toHaveBeenCalledWith(range, null, { includeMetadata: false });
    });

    test('removes blank entries from a comma-only role filter', async () => {
      const { req, res, next } = makeSut({ roles: ' , , ' });
      await getCountryApplications(req, res, next);
      expect(getMapAnalytics).toHaveBeenCalledWith(range, [], { includeMetadata: false });
    });

    test.each([['Developer'], { role: 'Developer' }, 12])(
      'returns 400 for a non-string roles filter: %p',
      async (roles) => {
        const { req, res, next } = makeSut({ roles });
        await getCountryApplications(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'roles must be a comma-separated string.',
        });
        expect(getMapAnalytics).not.toHaveBeenCalled();
        expect(cache.analytics.set).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
      },
    );

    test('enriches country rows and calculates totals without exposing service-only fields', async () => {
      getMapAnalytics.mockResolvedValue([
        {
          country: 'USA',
          countryName: 'United States',
          region: 'Americas',
          count: 7,
          roles: ['Developer'],
          jobIds: ['private-job-id'],
        },
        { country: 'IND', countryName: 'India', region: 'Asia', count: 3, roles: ['Designer'] },
      ]);
      getComparisonData.mockResolvedValue({
        comparisonData: { USA: { percentageChange: 40, previous: 5 } },
      });
      const { req, res, next } = makeSut();
      await getCountryApplications(req, res, next);
      const payload = res.json.mock.calls[0][0];
      expect(payload.data).toEqual([
        {
          country: 'USA',
          countryName: 'United States',
          region: 'Americas',
          count: 7,
          roles: ['Developer'],
          percentageChange: 40,
          previousCount: 5,
        },
        { country: 'IND', countryName: 'India', region: 'Asia', count: 3, roles: ['Designer'] },
      ]);
      expect(payload.meta).toEqual({
        startDate: range.start,
        endDate: range.end,
        type: 'weekly',
        roles: [],
        totalCountries: 2,
        totalApplicants: 10,
      });
      expect(getComparisonData).toHaveBeenCalledWith(range, previous, null);
      expect(cache.analytics.set).toHaveBeenCalledWith(expect.any(String), payload);
    });

    test('returns zero totals when no countries match', async () => {
      const { req, res, next } = makeSut();
      await getCountryApplications(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [],
          meta: expect.objectContaining({ totalCountries: 0, totalApplicants: 0 }),
        }),
      );
    });

    test('returns a cache hit without querying analytics or writing the cache again', async () => {
      const cached = { success: true, data: [{ country: 'USA', count: 2 }] };
      cache.analytics.get.mockReturnValue(cached);
      const { req, res, next } = makeSut();
      await getCountryApplications(req, res, next);
      expect(res.json).toHaveBeenCalledWith(cached);
      expect(getMapAnalytics).not.toHaveBeenCalled();
      expect(getComparisonData).not.toHaveBeenCalled();
      expect(cache.analytics.set).not.toHaveBeenCalled();
    });

    test('skips comparisons for all-time data', async () => {
      getRangeFromQuery.mockReturnValue({ ...range, type: 'all' });
      const { req, res, next } = makeSut({ filter: 'all' });
      await getCountryApplications(req, res, next);
      expect(getPreviousRange).not.toHaveBeenCalled();
      expect(getPreviousCustomRange).not.toHaveBeenCalled();
      expect(getComparisonData).not.toHaveBeenCalled();
    });

    test('uses the custom previous-period calculator for a custom date window', async () => {
      const custom = { ...range, type: 'custom' };
      getRangeFromQuery.mockReturnValue(custom);
      getPreviousCustomRange.mockReturnValue(previous);
      const { req, res, next } = makeSut();
      await getCountryApplications(req, res, next);
      expect(getPreviousCustomRange).toHaveBeenCalledWith(custom);
      expect(getPreviousRange).not.toHaveBeenCalled();
      expect(getComparisonData).toHaveBeenCalledWith(custom, previous, null);
    });

    test('does not request a comparison if there is no previous period', async () => {
      getPreviousRange.mockReturnValue(null);
      const { req, res, next } = makeSut();
      await getCountryApplications(req, res, next);
      expect(res.json).toHaveBeenCalled();
      expect(getComparisonData).not.toHaveBeenCalled();
    });

    test('preserves the date helper validation status and message', async () => {
      const error = Object.assign(new Error('Invalid date range'), { status: 422 });
      getRangeFromQuery.mockImplementation(() => {
        throw error;
      });
      const { req, res, next } = makeSut();
      await getCountryApplications(req, res, next);
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: error.message });
      expect(getMapAnalytics).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    test.each(['map', 'comparison'])(
      'passes unexpected %s failures to error middleware',
      async (stage) => {
        const error = new Error('database unavailable');
        if (stage === 'map') getMapAnalytics.mockRejectedValue(error);
        else getComparisonData.mockRejectedValue(error);
        const { req, res, next } = makeSut();
        await getCountryApplications(req, res, next);
        expect(next).toHaveBeenCalledWith(error);
        expect(res.json).not.toHaveBeenCalled();
        expect(cache.analytics.set).not.toHaveBeenCalled();
      },
    );
  });

  describe('getAvailableRoles', () => {
    test('returns sorted distinct roles with their count and caches the payload', async () => {
      Application.distinct.mockResolvedValue(['Designer', 'Developer', 'Administrator']);
      const { req, res, next } = makeSut();
      await getAvailableRoles(req, res, next);
      expect(Application.distinct).toHaveBeenCalledWith('role');
      const payload = { success: true, data: ['Administrator', 'Designer', 'Developer'], count: 3 };
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(cache.static.set).toHaveBeenCalledWith('available-roles', payload);
    });

    test('returns the cached roles without a database query', async () => {
      const payload = { success: true, data: ['Developer'], count: 1 };
      cache.static.get.mockReturnValue(payload);
      const { req, res, next } = makeSut();
      await getAvailableRoles(req, res, next);
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(Application.distinct).not.toHaveBeenCalled();
      expect(cache.static.set).not.toHaveBeenCalled();
    });

    test('returns and caches an empty role list', async () => {
      Application.distinct.mockResolvedValue([]);
      const { req, res, next } = makeSut();
      await getAvailableRoles(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: [], count: 0 });
    });

    test('forwards database failures without caching an error result', async () => {
      const error = new Error('database unavailable');
      Application.distinct.mockRejectedValue(error);
      const { req, res, next } = makeSut();
      await getAvailableRoles(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
      expect(res.json).not.toHaveBeenCalled();
      expect(cache.static.set).not.toHaveBeenCalled();
    });
  });
});
