/**
 * Allowlist for files uploaded with a public job application
 * (POST /api/jobforms/:formId/responses). Mirrors the `accept` lists on the
 * frontend form: resume takes documents only, per-question uploads also take images.
 */

const MIME_BY_EXTENSION = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
};

const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx'];
const ATTACHMENT_EXTENSIONS = [...DOCUMENT_EXTENSIONS, 'png', 'jpg', 'jpeg'];

// Question ids are Mongo ObjectIds (the frontend appends `questionFile_${q._id}`).
const QUESTION_FILE_FIELD = /^questionFile_[a-f0-9]{24}$/i;

const RESUME_TYPE_MESSAGE = 'Resume must be a PDF, DOC or DOCX file.';
const ATTACHMENT_TYPE_MESSAGE = 'Attachments must be PDF, DOC, DOCX, PNG or JPG files.';
const UNEXPECTED_FIELD_MESSAGE = 'Unexpected file field.';

function rawExtension(file) {
  const name = String(file?.originalname || '');
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

function rulesForField(fieldname) {
  if (fieldname === 'resume') {
    return { extensions: DOCUMENT_EXTENSIONS, message: RESUME_TYPE_MESSAGE };
  }
  if (QUESTION_FILE_FIELD.test(String(fieldname || ''))) {
    return { extensions: ATTACHMENT_EXTENSIONS, message: ATTACHMENT_TYPE_MESSAGE };
  }
  return null;
}

/**
 * Checks field name, extension and mimetype together.
 * @returns {{ ok: true } | { ok: false, reason: 'field' | 'type', message: string }}
 */
function checkJobApplicationFile(file) {
  const rules = rulesForField(file?.fieldname);
  if (!rules) {
    return { ok: false, reason: 'field', message: UNEXPECTED_FIELD_MESSAGE };
  }
  const extension = rawExtension(file);
  const mimetype = String(file?.mimetype || '').toLowerCase();
  const allowedMimes = MIME_BY_EXTENSION[extension] || [];
  if (!rules.extensions.includes(extension) || !allowedMimes.includes(mimetype)) {
    return { ok: false, reason: 'type', message: rules.message };
  }
  return { ok: true };
}

/** Extension for stored blob names: the allowlisted, lower-cased one, never client text. */
function safeFileExtension(file) {
  const extension = rawExtension(file);
  return ATTACHMENT_EXTENSIONS.includes(extension) ? extension : 'bin';
}

module.exports = {
  MIME_BY_EXTENSION,
  QUESTION_FILE_FIELD,
  checkJobApplicationFile,
  safeFileExtension,
};
