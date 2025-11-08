const timerSvc = require("../services/timerService");

function userIdFrom(req) {
  return req.headers["x-user-id"] || (req.user && req.user._id);
}

function ok(res, data) { return res.json({ ok: true, data }); }
function err(res, e)     {
  const status = e.status || 500;
  const payload = e.payload || null;
  return res.status(status).json({ ok: false, error: e.message, data: payload });
}

module.exports = {
  start: async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const { hours, minutes, taskId, note } = req.body || {};
      const data = await timerSvc.start({ userId, hours, minutes, taskId, note });
      return ok(res, data);
    } catch (e) { return err(res, e); }
  },

  pause: async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const data = await timerSvc.pause({ userId });
      return ok(res, data);
    } catch (e) { return err(res, e); }
  },

  resume: async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const data = await timerSvc.resume({ userId });
      return ok(res, data);
    } catch (e) { return err(res, e); }
  },

  stop: async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const data = await timerSvc.stop({ userId });
      return ok(res, data);
    } catch (e) { return err(res, e); }
  },

  status: async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const data = await timerSvc.status({ userId });
      return ok(res, data);
    } catch (e) { return err(res, e); }
  },

  reset: async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const data = await timerSvc.reset({ userId });
      return ok(res, data);
    } catch (e) { return err(res, e); }
  },

  history: async (req, res) => {
    try {
      const userId = userIdFrom(req);
      const { page = 1, limit = 20 } = req.query;
      const data = await timerSvc.history({ userId, page, limit });
      return ok(res, data);
    } catch (e) { return err(res, e); }
  },
};
