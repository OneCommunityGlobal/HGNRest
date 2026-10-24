const { getServerTime } = require('../serverTimeController');

describe('getServerTime', () => {
  it('should return the current server time details', () => {
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnValue({ json }),
    };

    getServerTime({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledTimes(1);

    const response = json.mock.calls[0][0];

    expect(response).toHaveProperty('serverTime');
    expect(response).toHaveProperty('date');
    expect(response).toHaveProperty('timezone');
    expect(response).toHaveProperty('timestamp');

    expect(typeof response.serverTime).toBe('string');
    expect(response.serverTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    expect(response.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(response.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);

    expect(typeof response.timestamp).toBe('number');
  });
});
