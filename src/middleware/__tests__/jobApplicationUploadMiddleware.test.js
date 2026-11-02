const express = require('express');
const request = require('supertest');
const {
  jobApplicationUploadMiddleware,
  JOB_APPLICATION_UPLOAD_LIMITS,
} = require('../jobApplicationUploadMiddleware');

const MB = 1024 * 1024;
const QUESTION_FIELD = 'questionFile_6a4f01a854e483075a73a6a9';
const PDF = { contentType: 'application/pdf' };

const buildApp = () => {
  const app = express();
  app.post('/upload', jobApplicationUploadMiddleware, (req, res) => {
    res.status(201).json({
      files: (req.files || []).map((f) => ({ fieldname: f.fieldname, size: f.size })),
      payload: req.body.payload,
    });
  });
  return app;
};

describe('jobApplicationUploadMiddleware', () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it('caps uploads at 5 MB, 6 files and a bounded number of fields', () => {
    expect(JOB_APPLICATION_UPLOAD_LIMITS).toEqual(
      expect.objectContaining({ fileSize: 5 * MB, files: 6, fields: 60, fieldSize: MB }),
    );
  });

  it('passes a valid small PDF resume and a question attachment through', async () => {
    const res = await request(app)
      .post('/upload')
      .field('payload', JSON.stringify({ applicantEmail: 'ada@example.com' }))
      .attach('resume', Buffer.from('%PDF-1.4 small'), { filename: 'resume.pdf', ...PDF })
      .attach(QUESTION_FIELD, Buffer.from('png'), {
        filename: 'photo.PNG',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.files).toEqual([
      { fieldname: 'resume', size: 14 },
      { fieldname: QUESTION_FIELD, size: 3 },
    ]);
    expect(JSON.parse(res.body.payload)).toEqual({ applicantEmail: 'ada@example.com' });
  });

  it('passes a request with no files through', async () => {
    const res = await request(app).post('/upload').field('email', 'ada@example.com');
    expect(res.status).toBe(201);
    expect(res.body.files).toEqual([]);
  });

  it('rejects an oversized file with 413', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('resume', Buffer.alloc(5 * MB + 1), { filename: 'big.pdf', ...PDF });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'File too large, max 5 MB.' });
  });

  it('rejects a disallowed file type with 400', async () => {
    const res = await request(app).post('/upload').attach('resume', Buffer.from('MZ'), {
      filename: 'resume.exe',
      contentType: 'application/x-msdownload',
    });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Resume must be a PDF, DOC or DOCX file.' });
  });

  it('rejects an allowed extension sent with a mismatched mimetype', async () => {
    const res = await request(app)
      .post('/upload')
      .attach(QUESTION_FIELD, Buffer.from('<script></script>'), {
        filename: 'cover.pdf',
        contentType: 'text/html',
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Attachments must be PDF, DOC, DOCX, PNG or JPG files.' });
  });

  it('rejects more than 6 files with 400', async () => {
    let req = request(app).post('/upload');
    for (let i = 0; i < 7; i += 1) {
      const id = `6a4f01a854e483075a73a6${String(i).padStart(2, '0')}`;
      req = req.attach(`questionFile_${id}`, Buffer.from('x'), { filename: 'a.pdf', ...PDF });
    }
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Too many files, max 6.' });
  });

  it('rejects an unexpected file field name with 400', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('avatar', Buffer.from('x'), { filename: 'a.pdf', ...PDF });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unexpected file field.' });
  });

  it('rejects the same file field sent twice with 400', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('resume', Buffer.from('a'), { filename: 'a.pdf', ...PDF })
      .attach('resume', Buffer.from('b'), { filename: 'b.pdf', ...PDF });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Each file field may only be sent once.' });
  });

  it('rejects an oversized text field with 413', async () => {
    const res = await request(app)
      .post('/upload')
      .field('payload', 'x'.repeat(MB + 1));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Form data too large.' });
  });

  it('rejects too many text fields with 400', async () => {
    let req = request(app).post('/upload');
    for (let i = 0; i < 61; i += 1) {
      req = req.field(`f${i}`, 'v');
    }
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Too many form fields.' });
  });
});
