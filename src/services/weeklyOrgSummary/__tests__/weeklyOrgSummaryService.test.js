jest.mock('../../../models/userProfile', () => ({ find: jest.fn() }));
jest.mock('../../../models/weeklyOrgSummarySettings', () => ({ findOne: jest.fn() }));
jest.mock('../../../models/weeklyOrgSummaryRun', () => ({
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../../../utilities/emailSender', () => jest.fn());
jest.mock('../../../utilities/orgSummaryPdf', () => ({ renderOrgSummaryPdfs: jest.fn() }));

const UserProfile = require('../../../models/userProfile');
const Settings = require('../../../models/weeklyOrgSummarySettings');
const Run = require('../../../models/weeklyOrgSummaryRun');
const emailSender = require('../../../utilities/emailSender');
const { renderOrgSummaryPdfs } = require('../../../utilities/orgSummaryPdf');
const { runWeeklyOrgSummary, runIfDue, MAX_ATTEMPTS } = require('../weeklyOrgSummaryService');

// Sunday 2026-10-25 08:00 Pacific; reports Sun 10/18 to Sat 10/24.
const SEND_TIME = new Date('2026-10-25T15:00:00Z');
const RUN_KEY = '2026-10-18';

let runs;

// In-memory stand-in for the run collection: unique runKey, conditional claim.
const installRunStore = () => {
  runs = new Map();
  Run.create.mockImplementation(async (doc) => {
    if (runs.has(doc.runKey)) throw Object.assign(new Error('dup'), { code: 11000 });
    const stored = { _id: doc.runKey, ...doc };
    runs.set(doc.runKey, stored);
    return { ...stored };
  });
  Run.findOneAndUpdate.mockImplementation(async (filter, update) => {
    const doc = runs.get(filter.runKey);
    if (!doc || !(doc.attempts < filter.attempts.$lt)) return null;
    const claimable = filter.$or.some(
      (c) =>
        doc.status === c.status && (c.leaseUntil === undefined || doc.leaseUntil < c.leaseUntil.$lt),
    );
    if (!claimable) return null;
    Object.assign(doc, update.$set);
    doc.attempts += update.$inc.attempts;
    return { ...doc };
  });
  Run.updateOne.mockImplementation(async ({ _id }, update) => {
    const doc = runs.get(_id);
    Object.assign(doc, update.$set);
    Object.entries(update.$addToSet || {}).forEach(([field, { $each }]) => {
      doc[field] = [...new Set([...(doc[field] || []), ...$each])];
    });
  });
};

const pdfResult = (periods) => periods.map((period) => ({ period, buffer: Buffer.from('pdf') }));

beforeEach(() => {
  jest.clearAllMocks();
  installRunStore();
  Settings.findOne.mockReturnValue({ lean: async () => ({ enabled: true }) });
  UserProfile.find.mockImplementation((query) => ({
    lean: async () =>
      query.getWeeklyReport
        ? [{ email: 'a@x.org' }, { email: 'b@x.org' }, { email: 'a@x.org' }, {}]
        : [{ email: 'admin@x.org' }],
  }));
  renderOrgSummaryPdfs.mockImplementation(async (periods) => pdfResult(periods));
  emailSender.mockResolvedValue('ok');
});

describe('runWeeklyOrgSummary', () => {
  it('emails three PDFs with the agreed subject, message and file names', async () => {
    const result = await runWeeklyOrgSummary({ now: SEND_TIME });

    expect(result).toMatchObject({ status: 'sent', runKey: RUN_KEY, recipients: 2 });
    expect(emailSender).toHaveBeenCalledTimes(1);
    const [to, subject, message, attachments] = emailSender.mock.calls[0];
    expect(to).toEqual(['a@x.org', 'b@x.org']);
    expect(subject).toBe('Total Org Summary Reports for October 25, 2026');
    expect(message).toContain(
      'Please find attached the weekly, monthly and annual comparison reports for One Community as an organization.',
    );
    expect(attachments.map((a) => a.filename)).toEqual([
      'October 25, 2026 Week-over-Week report.pdf',
      'October 25, 2026 Month-over-Month report.pdf',
      'October 25, 2026 Year-over-Year report.pdf',
    ]);
    expect(attachments.every((a) => a.contentType === 'application/pdf')).toBe(true);
  });

  it('records status, timestamps and recipients for the run', async () => {
    await runWeeklyOrgSummary({ now: SEND_TIME, trigger: 'manual' });
    expect(runs.get(RUN_KEY)).toMatchObject({
      status: 'sent',
      trigger: 'manual',
      attempts: 1,
      recipients: ['a@x.org', 'b@x.org'],
      subject: 'Total Org Summary Reports for October 25, 2026',
    });
    expect(runs.get(RUN_KEY).startedAt).toEqual(SEND_TIME);
    expect(runs.get(RUN_KEY).finishedAt).toBeInstanceOf(Date);
  });

  it('does not send twice when the week was already sent', async () => {
    await runWeeklyOrgSummary({ now: SEND_TIME });
    const again = await runWeeklyOrgSummary({ now: new Date('2026-10-25T16:00:00Z') });
    expect(again.status).toBe('skipped');
    expect(emailSender).toHaveBeenCalledTimes(1);
  });

  it('sends once when two instances race for the same week', async () => {
    const results = await Promise.all([
      runWeeklyOrgSummary({ now: SEND_TIME }),
      runWeeklyOrgSummary({ now: SEND_TIME }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['sent', 'skipped']);
    expect(emailSender).toHaveBeenCalledTimes(1);
  });

  it('marks the run failed, alerts admins, and lets a later retry succeed once', async () => {
    renderOrgSummaryPdfs.mockRejectedValueOnce(new Error('browser crashed'));

    const failed = await runWeeklyOrgSummary({ now: SEND_TIME });
    expect(failed).toMatchObject({ status: 'failed', error: 'browser crashed' });
    expect(runs.get(RUN_KEY)).toMatchObject({
      status: 'failed',
      attempts: 1,
      error: 'browser crashed',
    });
    expect(runs.get(RUN_KEY).alertSentAt).toBeInstanceOf(Date);
    expect(emailSender).toHaveBeenCalledTimes(1);
    expect(emailSender.mock.calls[0][0]).toEqual(['admin@x.org']);
    expect(emailSender.mock.calls[0][1]).toContain('failed');

    const retry = await runWeeklyOrgSummary({ now: new Date('2026-10-25T15:15:00Z') });
    expect(retry.status).toBe('sent');
    expect(runs.get(RUN_KEY).attempts).toBe(2);
    expect(emailSender).toHaveBeenCalledTimes(2);

    const afterSent = await runWeeklyOrgSummary({ now: new Date('2026-10-25T15:30:00Z') });
    expect(afterSent.status).toBe('skipped');
    expect(emailSender).toHaveBeenCalledTimes(2);
  });

  it('stops retrying after the maximum number of attempts', async () => {
    renderOrgSummaryPdfs.mockRejectedValue(new Error('still broken'));
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await runWeeklyOrgSummary({ now: new Date(SEND_TIME.getTime() + i * 60000) });
    }
    renderOrgSummaryPdfs.mockClear();
    const extra = await runWeeklyOrgSummary({ now: new Date('2026-10-25T16:00:00Z') });
    expect(extra.status).toBe('skipped');
    expect(renderOrgSummaryPdfs).not.toHaveBeenCalled();
    expect(runs.get(RUN_KEY)).toMatchObject({ status: 'failed', attempts: MAX_ATTEMPTS });
  });

  it('takes over a stuck run only after its lease expires', async () => {
    runs.set(RUN_KEY, {
      _id: RUN_KEY,
      runKey: RUN_KEY,
      status: 'running',
      attempts: 1,
      leaseUntil: new Date('2026-10-25T15:30:00Z'),
    });
    const held = await runWeeklyOrgSummary({ now: new Date('2026-10-25T15:10:00Z') });
    expect(held.status).toBe('skipped');
    const taken = await runWeeklyOrgSummary({ now: new Date('2026-10-25T16:00:00Z') });
    expect(taken.status).toBe('sent');
    expect(runs.get(RUN_KEY).attempts).toBe(2);
  });

  it('fails with a clear error when there are no recipients', async () => {
    UserProfile.find.mockImplementation((query) => ({
      lean: async () => (query.getWeeklyReport ? [] : [{ email: 'admin@x.org' }]),
    }));
    const result = await runWeeklyOrgSummary({ now: SEND_TIME });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/No Weekly Summary Report recipients/);
    expect(renderOrgSummaryPdfs).not.toHaveBeenCalled();
  });

  it('records disabled when email sending is switched off in this environment', async () => {
    emailSender.mockResolvedValue('EMAIL_SENDING_DISABLED_NON_PROD');
    const result = await runWeeklyOrgSummary({ now: SEND_TIME });
    expect(result.status).toBe('disabled');
    expect(runs.get(RUN_KEY).status).toBe('disabled');
  });

  it('still finishes the run when the failure alert itself cannot be sent', async () => {
    renderOrgSummaryPdfs.mockRejectedValueOnce(new Error('boom'));
    emailSender.mockRejectedValueOnce(new Error('smtp down'));
    const result = await runWeeklyOrgSummary({ now: SEND_TIME });
    expect(result.status).toBe('failed');
    expect(runs.get(RUN_KEY).status).toBe('failed');
  });
});

describe('sending in chunks', () => {
  const MANY = Array.from({ length: 120 }, (_, i) => ({ email: `u${i}@x.org` }));
  const useRecipients = (list) =>
    UserProfile.find.mockImplementation((query) => ({
      lean: async () => (query.getWeeklyReport ? list : [{ email: 'admin@x.org' }]),
    }));
  const reportCalls = () => emailSender.mock.calls.filter(([, subject]) => /^Total Org Summary Reports/.test(subject));

  it('sends to at most 50 recipients per message', async () => {
    useRecipients(MANY);
    await runWeeklyOrgSummary({ now: SEND_TIME });
    expect(reportCalls().map(([to]) => to.length)).toEqual([50, 50, 20]);
  });

  it('does not email anyone twice when a retry follows a partial failure', async () => {
    useRecipients(MANY);
    emailSender.mockImplementation(async (to, subject) => {
      if (/^Total Org Summary Reports/.test(subject) && to.includes('u50@x.org')) {
        throw new Error('smtp dropped');
      }
      return 'ok';
    });

    const failed = await runWeeklyOrgSummary({ now: SEND_TIME });
    expect(failed.status).toBe('failed');
    expect(failed.error).toMatch(/50 of 120/);
    expect(runs.get(RUN_KEY).sentTo).toHaveLength(50);

    emailSender.mockImplementation(async () => 'ok');
    const retry = await runWeeklyOrgSummary({ now: new Date('2026-10-25T15:15:00Z') });
    expect(retry).toMatchObject({ status: 'sent', recipients: 120 });

    const everyone = reportCalls().flatMap(([to]) => to);
    expect(new Set(everyone).size).toBe(120);
    expect(everyone.filter((e) => e === 'u0@x.org')).toHaveLength(1);
    expect(runs.get(RUN_KEY).recipients).toHaveLength(120);
  });

  it('marks the run sent without rendering again when everyone already received it', async () => {
    runs.set(RUN_KEY, {
      _id: RUN_KEY,
      runKey: RUN_KEY,
      status: 'failed',
      attempts: 1,
      sentTo: ['a@x.org', 'b@x.org'],
    });
    const result = await runWeeklyOrgSummary({ now: SEND_TIME });
    expect(result.status).toBe('sent');
    expect(renderOrgSummaryPdfs).not.toHaveBeenCalled();
    expect(reportCalls()).toHaveLength(0);
  });
});

describe('runIfDue', () => {
  it('does nothing before the scheduled time or when disabled', async () => {
    expect((await runIfDue(new Date('2026-10-25T14:00:00Z'))).status).toBe('not-due');
    Settings.findOne.mockReturnValue({ lean: async () => ({ enabled: false }) });
    expect((await runIfDue(SEND_TIME)).status).toBe('not-due');
    expect(emailSender).not.toHaveBeenCalled();
  });

  it('sends once per week across repeated ticks', async () => {
    expect((await runIfDue(SEND_TIME)).status).toBe('sent');
    expect((await runIfDue(new Date('2026-10-25T15:15:00Z'))).status).toBe('skipped');
    expect(emailSender).toHaveBeenCalledTimes(1);
  });

  it('honours an admin-changed schedule from settings', async () => {
    Settings.findOne.mockReturnValue({
      lean: async () => ({ enabled: true, dayOfWeek: 1, hour: 9, timezone: 'America/Los_Angeles' }),
    });
    expect((await runIfDue(SEND_TIME)).status).toBe('not-due');
    // Monday 2026-10-26 09:00 Pacific
    expect((await runIfDue(new Date('2026-10-26T16:00:00Z'))).status).toBe('sent');
  });
});
