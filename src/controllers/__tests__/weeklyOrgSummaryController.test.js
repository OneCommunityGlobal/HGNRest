jest.mock('../../utilities/permissions', () => ({ hasPermission: jest.fn() }));
jest.mock('../../models/weeklyOrgSummarySettings', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../../services/weeklyOrgSummary/weeklyOrgSummaryService', () => ({
  getStatus: jest.fn(),
  runWeeklyOrgSummary: jest.fn(),
}));

const { hasPermission } = require('../../utilities/permissions');
const Settings = require('../../models/weeklyOrgSummarySettings');
const service = require('../../services/weeklyOrgSummary/weeklyOrgSummaryService');
const weeklyOrgSummaryController = require('../weeklyOrgSummaryController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = (body = {}) => ({ body: { requestor: { requestorId: 'u1' }, ...body } });

describe('weeklyOrgSummaryController', () => {
  const controller = weeklyOrgSummaryController();

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    service.getStatus.mockResolvedValue({ nextScheduledSend: 'x', recentRuns: [] });
  });

  it('rejects every endpoint for requestors without permission', async () => {
    hasPermission.mockResolvedValue(false);
    const handlers = [controller.getStatus, controller.updateSettings, controller.sendNow];
    for (const handler of handlers) {
      const res = makeRes();
      // eslint-disable-next-line no-await-in-loop
      await handler(makeReq(), res);
      expect(res.status).toHaveBeenCalledWith(403);
    }
    expect(Settings.findOneAndUpdate).not.toHaveBeenCalled();
    expect(service.runWeeklyOrgSummary).not.toHaveBeenCalled();
  });

  it('returns the status with the next scheduled send and recent runs', async () => {
    const res = makeRes();
    await controller.getStatus(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ nextScheduledSend: 'x', recentRuns: [] });
  });

  it('rejects invalid schedule values without saving', async () => {
    const res = makeRes();
    await controller.updateSettings(makeReq({ dayOfWeek: 9, timezone: 'Nope/Zone' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send.mock.calls[0][0].errors).toHaveLength(2);
    expect(Settings.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('saves only the known schedule fields and records who changed them', async () => {
    const res = makeRes();
    await controller.updateSettings(
      makeReq({ enabled: true, dayOfWeek: 1, hour: 9, timezone: 'Asia/Kolkata', evil: 'x' }),
      res,
    );
    const [filter, update, options] = Settings.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ key: 'default' });
    expect(update.$set).toMatchObject({
      enabled: true,
      dayOfWeek: 1,
      hour: 9,
      timezone: 'Asia/Kolkata',
      updatedBy: 'u1',
    });
    expect(update.$set.evil).toBeUndefined();
    expect(options).toMatchObject({ upsert: true });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sends now through the same weekly claim and reports failures', async () => {
    service.runWeeklyOrgSummary.mockResolvedValueOnce({ status: 'sent' });
    const ok = makeRes();
    await controller.sendNow(makeReq(), ok);
    expect(service.runWeeklyOrgSummary).toHaveBeenCalledWith({ trigger: 'manual' });
    expect(ok.status).toHaveBeenCalledWith(200);

    service.runWeeklyOrgSummary.mockResolvedValueOnce({ status: 'failed', error: 'boom' });
    const bad = makeRes();
    await controller.sendNow(makeReq(), bad);
    expect(bad.status).toHaveBeenCalledWith(500);
  });
});
