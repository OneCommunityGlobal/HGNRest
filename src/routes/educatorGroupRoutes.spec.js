const ctrl = require('../controllers/educatorGroupController');
const router = require('./educatorGroupRoutes');

describe('Student Groups create route authorization', () => {
  const { route } = router.stack.find(
    (layer) => layer.route?.path === '/groups' && layer.route.methods.post,
  );
  const authorize = route.stack[0].handle;

  test('runs authorization before the real create controller', () => {
    expect(route.stack[1].handle).toBe(ctrl.createGroup);
  });

  test.each(['Owner', 'Educator', 'Manager', 'Administrator'])('allows %s', (role) => {
    const next = jest.fn();
    const res = { status: jest.fn() };
    authorize({ body: { requestor: { role } } }, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test.each(['Volunteer', 'student', 'owner', undefined])('rejects %s', (role) => {
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    authorize({ body: { requestor: role ? { role } : undefined } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: insufficient role privileges' });
    expect(next).not.toHaveBeenCalled();
  });
});
