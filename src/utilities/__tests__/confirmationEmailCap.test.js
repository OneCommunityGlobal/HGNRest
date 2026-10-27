jest.mock('../../models/jobApplicationsModel');

const Response = require('../../models/jobApplicationsModel');
const {
  shouldSendConfirmation,
  maskEmail,
  MAX_CONFIRMATIONS_PER_ADDRESS,
  MAX_CONFIRMATIONS_PER_DAY,
  WINDOW_MS,
} = require('../confirmationEmailCap');

const NOW = new Date('2026-10-19T12:00:00.000Z');

// Route the mocked count by query shape: per-address queries carry `email`, the global one does not.
const mockCounts = ({ address = 1, global = 1 } = {}) => {
  Response.countDocuments = jest.fn((query) =>
    Promise.resolve(Object.prototype.hasOwnProperty.call(query, 'email') ? address : global),
  );
};

describe('confirmationEmailCap', () => {
  let warnSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('exports the approved limits and a 24 hour window', () => {
    expect(MAX_CONFIRMATIONS_PER_ADDRESS).toBe(3);
    expect(MAX_CONFIRMATIONS_PER_DAY).toBe(300);
    expect(WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('sends when the address and global counts are under the caps', async () => {
    mockCounts({ address: 1, global: 10 });
    await expect(shouldSendConfirmation('ada@example.com', NOW)).resolves.toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still sends for the 3rd application from one address in 24 h (count includes the new one)', async () => {
    mockCounts({ address: 3, global: 3 });
    await expect(shouldSendConfirmation('ada@example.com', NOW)).resolves.toBe(true);
  });

  it('skips the 4th application from one address in 24 h and warns once', async () => {
    mockCounts({ address: 4, global: 4 });
    await expect(shouldSendConfirmation('ada@example.com', NOW)).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0].join(' ')).toContain('per-address');
  });

  it('still sends at exactly 300 applications globally in 24 h', async () => {
    mockCounts({ address: 1, global: 300 });
    await expect(shouldSendConfirmation('ada@example.com', NOW)).resolves.toBe(true);
  });

  it('skips once the global count passes 300 in 24 h', async () => {
    mockCounts({ address: 1, global: 301 });
    await expect(shouldSendConfirmation('ada@example.com', NOW)).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0].join(' ')).toContain('global');
  });

  it('only counts applications created in the last 24 h, for the normalized address', async () => {
    mockCounts();
    await shouldSendConfirmation('  Ada@Example.COM ', NOW);

    const since = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(Response.countDocuments).toHaveBeenCalledWith({
      email: 'ada@example.com',
      createdAt: { $gte: since },
    });
    expect(Response.countDocuments).toHaveBeenCalledWith({ createdAt: { $gte: since } });
    expect(Response.countDocuments).toHaveBeenCalledTimes(2);
  });

  it('fails open and logs when the count query throws', async () => {
    Response.countDocuments = jest.fn().mockRejectedValue(new Error('db hiccup'));
    await expect(shouldSendConfirmation('ada@example.com', NOW)).resolves.toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0].join(' ')).not.toContain('ada@example.com');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('never logs the full email address when capped', async () => {
    mockCounts({ address: 4, global: 4 });
    await shouldSendConfirmation('ada.lovelace@example.com', NOW);
    const logged = warnSpy.mock.calls[0].join(' ');
    expect(logged).not.toContain('ada.lovelace');
    expect(logged).toContain('a***@example.com');
  });

  it('masks addresses to the first character plus the domain', () => {
    expect(maskEmail('ada@example.com')).toBe('a***@example.com');
    expect(maskEmail('no-at-sign')).toBe('n***');
    expect(maskEmail('')).toBe('***');
  });
});

describe('JobApplications indexes for the cap queries', () => {
  it('serves the per-address and the global 24 h counts', () => {
    jest.unmock('../../models/jobApplicationsModel');
    jest.isolateModules(() => {
      const FreshModel = require('../../models/jobApplicationsModel');
      const keys = FreshModel.schema.indexes().map(([spec]) => JSON.stringify(spec));
      expect(keys).toContain(JSON.stringify({ email: 1, createdAt: -1 }));
      expect(keys).toContain(JSON.stringify({ createdAt: -1 }));
    });
  });
});
