const { checkJobApplicationFile, safeFileExtension } = require('../jobApplicationFileTypes');

const QUESTION_FIELD = 'questionFile_6a4f01a854e483075a73a6a9';

describe('checkJobApplicationFile', () => {
  it.each([
    ['resume', 'cv.pdf', 'application/pdf'],
    ['resume', 'cv.doc', 'application/msword'],
    [
      'resume',
      'CV.DOCX',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [QUESTION_FIELD, 'cover.pdf', 'application/pdf'],
    [QUESTION_FIELD, 'photo.png', 'image/png'],
    [QUESTION_FIELD, 'photo.jpg', 'image/jpeg'],
    [QUESTION_FIELD, 'photo.JPEG', 'image/jpeg'],
  ])('accepts %s %s (%s)', (fieldname, originalname, mimetype) => {
    expect(checkJobApplicationFile({ fieldname, originalname, mimetype })).toEqual({ ok: true });
  });

  it('rejects an image for the resume field', () => {
    expect(
      checkJobApplicationFile({
        fieldname: 'resume',
        originalname: 'me.png',
        mimetype: 'image/png',
      }),
    ).toEqual({ ok: false, reason: 'type', message: 'Resume must be a PDF, DOC or DOCX file.' });
  });

  it('rejects a disallowed extension for a question file', () => {
    expect(
      checkJobApplicationFile({
        fieldname: QUESTION_FIELD,
        originalname: 'run.exe',
        mimetype: 'application/octet-stream',
      }),
    ).toEqual({
      ok: false,
      reason: 'type',
      message: 'Attachments must be PDF, DOC, DOCX, PNG or JPG files.',
    });
  });

  it('rejects an allowed extension paired with the wrong mimetype', () => {
    expect(
      checkJobApplicationFile({
        fieldname: 'resume',
        originalname: 'cv.pdf',
        mimetype: 'text/html',
      }),
    ).toEqual(expect.objectContaining({ ok: false, reason: 'type' }));
  });

  it('rejects files without an extension', () => {
    expect(
      checkJobApplicationFile({
        fieldname: 'resume',
        originalname: 'pdf',
        mimetype: 'application/pdf',
      }),
    ).toEqual(expect.objectContaining({ ok: false, reason: 'type' }));
  });

  it.each(['avatar', 'questionFile_', 'questionFile_123', 'questionFile_../../x', 'Resume '])(
    'rejects the unexpected field name %p',
    (fieldname) => {
      expect(
        checkJobApplicationFile({ fieldname, originalname: 'a.pdf', mimetype: 'application/pdf' }),
      ).toEqual({ ok: false, reason: 'field', message: 'Unexpected file field.' });
    },
  );
});

describe('safeFileExtension', () => {
  it('returns the lower-cased allowlisted extension', () => {
    expect(safeFileExtension({ originalname: 'My.Resume.PDF' })).toBe('pdf');
    expect(safeFileExtension({ originalname: 'photo.JPEG' })).toBe('jpeg');
  });

  it('falls back to bin for anything off the allowlist or missing', () => {
    expect(safeFileExtension({ originalname: 'evil.html' })).toBe('bin');
    expect(safeFileExtension({ originalname: 'x.pdf/../../y' })).toBe('bin');
    expect(safeFileExtension({ originalname: 'noext' })).toBe('bin');
    expect(safeFileExtension(undefined)).toBe('bin');
  });
});
