const inventoryTypeRouter = require('./bmInventoryTypeRouter');

describe('bmInventoryTypeRouter generic inventory type routes', () => {
  it('registers PUT and DELETE handlers at /invtypes/:id', () => {
    const router = inventoryTypeRouter({}, {}, {}, {}, {}, {}, {}, {});
    const route = router.stack.find((layer) => layer.route?.path === '/invtypes/:id');

    expect(route).toBeDefined();
    expect(route.route.methods).toEqual({ put: true, delete: true });
  });
});
