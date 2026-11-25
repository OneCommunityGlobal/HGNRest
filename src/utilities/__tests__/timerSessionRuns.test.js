const { startRun, closeOpenRun, clearRuns, resolveRuns } = require('../timerSessionRuns');

const HOUR = 60 * 60 * 1000;

const at = (iso) => new Date(iso);

describe('sessionRuns helpers', () => {
  it('opens a run on start and closes it at the pause time', () => {
    const client = { started: false, time: 5 * HOUR, runs: [] };
    startRun(client, at('2026-10-27T05:42:00Z'));
    expect(client.runs).toEqual([{ startedAt: at('2026-10-27T05:42:00Z'), endedAt: null }]);

    closeOpenRun(client, at('2026-10-27T06:12:00Z'));
    expect(client.runs[0].endedAt).toEqual(at('2026-10-27T06:12:00Z'));
  });

  it('stops counting at zero when the pause arrives hours later', () => {
    const client = { started: false, time: 5 * HOUR, runs: [] };
    startRun(client, at('2026-10-27T05:42:00Z'));

    closeOpenRun(client, at('2026-10-27T17:45:00Z'));
    expect(client.runs[0].endedAt).toEqual(at('2026-10-27T10:42:00Z'));
  });

  it('never leaves two open runs when start is sent twice', () => {
    const client = { started: true, time: 5 * HOUR, runs: [] };
    startRun(client, at('2026-10-27T18:00:00Z'));
    startRun(client, at('2026-10-27T18:10:00Z'));

    expect(client.runs).toHaveLength(2);
    expect(client.runs[0].endedAt).toEqual(at('2026-10-27T18:10:00Z'));
    expect(client.runs[1].endedAt).toBeNull();
  });

  it('starts a fresh list for a new session', () => {
    const client = {
      started: false,
      time: 5 * HOUR,
      runs: [{ startedAt: at('2026-10-26T18:00:00Z'), endedAt: at('2026-10-26T19:00:00Z') }],
    };
    startRun(client, at('2026-10-27T18:00:00Z'));

    expect(client.runs).toHaveLength(1);
    expect(client.runs[0].startedAt).toEqual(at('2026-10-27T18:00:00Z'));
  });

  it('copes with a timer saved before runs existed', () => {
    const client = { started: true, time: 5 * HOUR };
    startRun(client, at('2026-10-27T18:00:00Z'));
    expect(client.runs).toHaveLength(1);
  });

  it('resolves the run that is still counting, capped at the time left', () => {
    const client = {
      started: true,
      time: 2 * HOUR,
      runs: [
        { startedAt: at('2026-10-27T02:00:00Z'), endedAt: at('2026-10-27T03:00:00Z') },
        { startedAt: at('2026-10-27T04:00:00Z'), endedAt: null },
      ],
    };

    expect(resolveRuns(client, at('2026-10-27T05:00:00Z'))).toEqual([
      { startedAt: at('2026-10-27T02:00:00Z'), endedAt: at('2026-10-27T03:00:00Z'), open: false },
      { startedAt: at('2026-10-27T04:00:00Z'), endedAt: at('2026-10-27T05:00:00Z'), open: true },
    ]);
    expect(resolveRuns(client, at('2026-10-27T09:00:00Z'))[1].endedAt).toEqual(
      at('2026-10-27T06:00:00Z'),
    );
  });

  it('clears the runs', () => {
    const client = { runs: [{ startedAt: new Date(), endedAt: null }] };
    clearRuns(client);
    expect(client.runs).toEqual([]);
  });
});
