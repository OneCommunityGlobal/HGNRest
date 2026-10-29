/**
 * A "run" is one stretch of the timer actually counting down. Runs are kept on the timer
 * document itself, so they are saved with every start/pause/stop and a session that crosses
 * midnight can be split per day when it is logged.
 */

const toMs = (value) => new Date(value).getTime();

const lastRun = (client) => {
  const runs = client.runs || [];
  return runs[runs.length - 1];
};

// How long a run really counted for. The timer stops counting at zero, even if the pause
// only arrives later (for example when the browser was closed overnight).
const cappedEnd = (startedAt, now, remaining) => {
  const limit = Number.isFinite(Number(remaining)) ? Number(remaining) : Infinity;
  const ranFor = Math.max(Math.min(toMs(now) - toMs(startedAt), limit), 0);
  return new Date(toMs(startedAt) + ranFor);
};

const closeOpenRun = (client, now = new Date()) => {
  const run = lastRun(client);
  if (!run || run.endedAt) return;
  run.endedAt = cappedEnd(run.startedAt, now, client.time);
};

const clearRuns = (client) => {
  client.runs = [];
};

const startRun = (client, now = new Date()) => {
  if (!client.started || !client.runs) clearRuns(client);
  closeOpenRun(client, now);
  client.runs.push({ startedAt: now, endedAt: null });
};

// Closed runs plus the run that is still counting down, if any (flagged open, so a client
// that logs later can cap it at its own current time).
const resolveRuns = (client, now = new Date()) =>
  (client.runs || []).map((run) => ({
    startedAt: new Date(run.startedAt),
    endedAt: run.endedAt ? new Date(run.endedAt) : cappedEnd(run.startedAt, now, client.time),
    open: !run.endedAt,
  }));

module.exports = { startRun, closeOpenRun, clearRuns, resolveRuns };
