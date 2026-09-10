jest.mock('../../services/projectStatus.service', () => ({
  getProjectStatusSummary: jest.fn(),
}));

const { getProjectStatusSummary } = require('../../services/projectStatus.service');
const { fetchProjectStatus } = require('../projectStatus.controller');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

describe('projectStatus.controller.fetchProjectStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls the service with undefined dates and returns its data when no query params are given', async () => {
    const data = { totalProjects: 5 };
    getProjectStatusSummary.mockResolvedValue(data);
    const req = { query: {} };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(getProjectStatusSummary).toHaveBeenCalledWith({
      startDate: undefined,
      endDate: undefined,
    });
    expect(res.json).toHaveBeenCalledWith(data);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes valid startDate and endDate through to the service', async () => {
    const data = { totalProjects: 2 };
    getProjectStatusSummary.mockResolvedValue(data);
    const req = { query: { startDate: '2020-01-01', endDate: '2020-01-31' } };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(getProjectStatusSummary).toHaveBeenCalledWith({
      startDate: '2020-01-01',
      endDate: '2020-01-31',
    });
    expect(res.json).toHaveBeenCalledWith(data);
  });

  // NOTE: dayjs's `customParseFormat` plugin is not registered in this codebase, so the
  // 'YYYY-MM-DD' strict-format check in validateDateParam has no effect: dayjs falls back to
  // native Date parsing, and only wholly unparseable strings are rejected as "Invalid".
  // A wrong-but-parseable format like '01-01-2020' currently passes validation.
  it('rejects an unparseable startDate with 400', async () => {
    const req = { query: { startDate: 'not-a-real-date' } };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid startDate (YYYY-MM-DD)' });
    expect(getProjectStatusSummary).not.toHaveBeenCalled();
  });

  it('rejects a malformed endDate with 400', async () => {
    const req = { query: { endDate: 'not-a-date' } };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid endDate (YYYY-MM-DD)' });
    expect(getProjectStatusSummary).not.toHaveBeenCalled();
  });

  it('rejects a startDate in the future with 400', async () => {
    const req = { query: { startDate: '2099-01-01' } };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'startDate cannot be in the future' });
    expect(getProjectStatusSummary).not.toHaveBeenCalled();
  });

  it('rejects an endDate in the future with 400', async () => {
    const req = { query: { endDate: '2099-01-01' } };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'endDate cannot be in the future' });
    expect(getProjectStatusSummary).not.toHaveBeenCalled();
  });

  it('rejects a startDate that is after the endDate with 400', async () => {
    const req = { query: { startDate: '2020-02-01', endDate: '2020-01-01' } };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'startDate cannot be after endDate' });
    expect(getProjectStatusSummary).not.toHaveBeenCalled();
  });

  it('returns 500 and logs the error when the service throws', async () => {
    const error = new Error('DB down');
    getProjectStatusSummary.mockRejectedValue(error);
    const req = { query: {} };
    const res = makeRes();

    await fetchProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal server error' });
    // eslint-disable-next-line no-console
    expect(console.error).toHaveBeenCalledWith('fetchProjectStatus error:', error);
  });
});
