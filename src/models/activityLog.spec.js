const mongoose = require('mongoose');
const ActivityLog = require('./activityLog');

describe('ActivityLog model - time_logged action_type', () => {
  const validActorId = new mongoose.Types.ObjectId();

  it('accepts the time_logged action_type used by the timer Daily Log integration', () => {
    const doc = new ActivityLog({
      actor_id: validActorId,
      action_type: 'time_logged',
      entity_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      metadata: {
        taskId: new mongoose.Types.ObjectId().toString(),
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 1860000,
      },
    });

    const validationError = doc.validateSync();
    expect(validationError).toBeUndefined();
  });

  it('still rejects an action_type outside the enum', () => {
    const doc = new ActivityLog({
      actor_id: validActorId,
      action_type: 'not_a_real_type',
      entity_id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });

    const validationError = doc.validateSync();
    expect(validationError).toBeDefined();
    expect(validationError.errors.action_type).toBeDefined();
  });

  it('generates a valid UUID entity_id when none is supplied', () => {
    const doc = new ActivityLog({ actor_id: validActorId, action_type: 'time_logged' });

    expect(doc.entity_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(doc.validateSync()).toBeUndefined();
  });

  it('rejects a non-UUID entity_id and says so in the message', () => {
    const doc = new ActivityLog({
      actor_id: validActorId,
      action_type: 'time_logged',
      entity_id: 'not-a-uuid',
    });

    const validationError = doc.validateSync();

    expect(validationError.errors.entity_id).toBeDefined();
    expect(validationError.errors.entity_id.message).toBe('not-a-uuid is not a valid UUID!');
  });
});
