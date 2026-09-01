const XScheduledPost = require('./xScheduledPost');

describe('XScheduledPost model', () => {
  test('declares indexes for scheduled retrieval and posted history', () => {
    const indexes = XScheduledPost.schema.indexes().map(([fields]) => fields);

    expect(indexes).toEqual(
      expect.arrayContaining([{ scheduledAt: 1 }, { status: 1, postedAt: -1 }]),
    );
  });
});
