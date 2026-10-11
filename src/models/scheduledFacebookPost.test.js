const ScheduledFacebookPost = require('./scheduledFacebookPost');

describe('ScheduledFacebookPost schema', () => {
  it('applies the scheduler defaults and retains uploaded-image metadata', () => {
    const post = new ScheduledFacebookPost({
      scheduledFor: new Date('2099-01-01T12:00:00.000Z'),
      imageData: Buffer.from('image'),
      imageMimeType: 'image/png',
      imageOriginalName: 'photo.png',
    });

    expect(post.validateSync()).toBeUndefined();
    expect(post).toEqual(
      expect.objectContaining({
        message: '',
        timezone: 'America/Los_Angeles',
        status: 'pending',
        postMethod: 'scheduled',
        attempts: 0,
        imageMimeType: 'image/png',
        imageOriginalName: 'photo.png',
      }),
    );
    expect(post.imageData.equals(Buffer.from('image'))).toBe(true);
  });

  it.each([
    ['status', 'operator-shaped'],
    ['postMethod', 'unexpected'],
  ])('rejects values outside the %s enum', (field, value) => {
    const post = new ScheduledFacebookPost({
      scheduledFor: new Date('2099-01-01T12:00:00.000Z'),
      [field]: value,
    });

    const validationError = post.validateSync();

    expect(validationError.errors[field].kind).toBe('enum');
  });

  it('requires a scheduled time', () => {
    const post = new ScheduledFacebookPost({ message: 'missing time' });

    const validationError = post.validateSync();

    expect(validationError.errors.scheduledFor.kind).toBe('required');
  });
});
