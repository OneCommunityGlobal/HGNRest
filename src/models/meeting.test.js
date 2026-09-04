const mongoose = require('mongoose');

describe('meeting model', () => {
  it('exports a mongoose model with expected schema paths', () => {
    // Clear cached model so require executes schema definition in this suite
    delete mongoose.connection.models.Meeting;
    jest.resetModules();

    const Meeting = require('./meeting');

    expect(Meeting.modelName).toBe('Meeting');
    expect(Meeting.schema.path('dateTime')).toBeDefined();
    expect(Meeting.schema.path('duration')).toBeDefined();
    expect(Meeting.schema.path('organizer')).toBeDefined();
    expect(Meeting.schema.path('participantList')).toBeDefined();
    expect(Meeting.schema.path('location')).toBeDefined();
    expect(Meeting.schema.path('locationDetails')).toBeDefined();
    expect(Meeting.schema.path('notes')).toBeDefined();
  });
});
