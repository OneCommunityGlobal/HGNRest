const { getApplicationBlobName } = require('./jobApplicationBlobValidator');

describe('Job application blob validator', () => {
  const origin = 'https://example.blob.core.windows.net';
  const container = 'uploads';

  test('accepts a valid application resume URL', () => {
    expect(
      getApplicationBlobName(`${origin}/${container}/resumes/applicant.pdf`, origin, container),
    ).toBe('resumes/applicant.pdf');
  });

  test('rejects URLs from another storage origin', () => {
    expect(
      getApplicationBlobName(
        'https://evil.example/uploads/resumes/applicant.pdf',
        origin,
        container,
      ),
    ).toBeNull();
  });

  test('rejects HTTP URLs', () => {
    expect(
      getApplicationBlobName(
        'http://example.blob.core.windows.net/uploads/resumes/applicant.pdf',
        origin,
        container,
      ),
    ).toBeNull();
  });

  test('rejects files outside the resumes folder', () => {
    expect(
      getApplicationBlobName(`${origin}/${container}/other/document.pdf`, origin, container),
    ).toBeNull();
  });

  test('rejects encoded path traversal', () => {
    expect(
      getApplicationBlobName(`${origin}/${container}/resumes/%2e%2e/secret.pdf`, origin, container),
    ).toBeNull();
  });

  test('rejects URLs containing query parameters', () => {
    expect(
      getApplicationBlobName(
        `${origin}/${container}/resumes/applicant.pdf?token=fake`,
        origin,
        container,
      ),
    ).toBeNull();
  });

  test('rejects unexpected nested directories', () => {
    expect(
      getApplicationBlobName(
        `${origin}/${container}/resumes/subfolder/applicant.pdf`,
        origin,
        container,
      ),
    ).toBeNull();
  });

  test('rejects invalid inputs', () => {
    expect(getApplicationBlobName(null, origin, container)).toBeNull();
    expect(getApplicationBlobName('not-a-url', origin, container)).toBeNull();
  });
});
