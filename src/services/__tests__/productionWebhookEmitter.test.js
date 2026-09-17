process.env.PRODUCTION_STATUS_WEBHOOK_SECRET = 'emit-secret';
process.env.DEV_IDENTITY_WEBHOOK_URL =
  'https://dev.example.com/api/webhooks/production-user-status';
process.env.PRODUCTION_IDENTITY_WEBHOOK_EMIT_ENABLED = 'true';
process.env.PRODUCTION_IDENTITY_DEV_DB_NAME = 'hgnData_dev';
process.env.dbName = 'hgnData_prod';

jest.mock('node-fetch', () => jest.fn());

describe('productionWebhookEmitter', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.PRODUCTION_STATUS_WEBHOOK_SECRET = 'emit-secret';
    process.env.DEV_IDENTITY_WEBHOOK_URL =
      'https://dev.example.com/api/webhooks/production-user-status';
    process.env.PRODUCTION_IDENTITY_WEBHOOK_EMIT_ENABLED = 'true';
    process.env.PRODUCTION_IDENTITY_DEV_DB_NAME = 'hgnData_dev';
    process.env.dbName = 'hgnData_prod';
    const fetch = require('node-fetch');
    fetch.mockReset();
  });

  test('does not emit when running on dev database', async () => {
    process.env.dbName = 'hgnData_dev';
    const fetch = require('node-fetch');
    const emitter = require('../productionWebhookEmitter');

    const result = await emitter.emitProductionUserStatusChange({
      productionUserId: 'p1',
      email: 'user@example.com',
      status: 'inactive',
    });

    expect(result.emitted).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('emits signed payload on production database', async () => {
    const fetch = require('node-fetch');
    fetch.mockResolvedValue({ ok: true, status: 200 });
    const emitter = require('../productionWebhookEmitter');

    const result = await emitter.emitProductionUserStatusChange({
      productionUserId: 'p1',
      email: 'user@example.com',
      status: 'inactive',
    });

    expect(result.emitted).toBe(true);
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://dev.example.com/api/webhooks/production-user-status',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Webhook-Signature': expect.any(String),
        }),
      }),
    );
  });

  test('returns emitted false when webhook URL not configured', async () => {
    process.env.DEV_IDENTITY_WEBHOOK_URL = '';
    const fetch = require('node-fetch');
    const emitter = require('../productionWebhookEmitter');

    const result = await emitter.emitProductionUserStatusChange({
      productionUserId: 'p1',
      email: 'user@example.com',
      status: 'inactive',
    });

    expect(result.emitted).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('buildSignature is deterministic', () => {
    const emitter = require('../productionWebhookEmitter');
    const signature = emitter.buildSignature('{"status":"inactive"}');
    expect(signature).toHaveLength(64);
    expect(signature).toBe(emitter.buildSignature('{"status":"inactive"}'));
  });
});
