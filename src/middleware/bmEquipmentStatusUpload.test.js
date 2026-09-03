/**
 * Tests for bmEquipmentStatusUpload middleware.
 *
 * Strategy: multer is mocked so we can control the outcome of upload.single('image')
 * via the `multerCallbackError` variable. The fileFilter function is extracted from
 * the config multer was called with and tested directly.
 *
 * Important: multerConfig and multerInstance are captured at module level immediately
 * after require, before any jest.clearAllMocks() calls can erase them.
 */

let multerCallbackError = null;

jest.mock('multer', () => {
  const singleMiddleware = jest.fn((req, res, cb) => cb(multerCallbackError));
  const instance = { single: jest.fn(() => singleMiddleware) };
  const multerMock = jest.fn(() => instance);
  multerMock.memoryStorage = jest.fn(() => ({}));
  return multerMock;
});

const multer = require('multer');
const {
  bmEquipmentStatusUpload,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  INVALID_IMAGE_ERROR,
  IMAGE_NOT_SAVED_ERROR,
} = require('./bmEquipmentStatusUpload');

// Capture once here — before any jest.clearAllMocks() in beforeEach can erase them
const multerConfig = multer.mock.calls[0][0];
const multerInstance = multer.mock.results[0].value;

describe('bmEquipmentStatusUpload', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    multerCallbackError = null;
    jest.clearAllMocks();
    mockReq = { is: jest.fn() };
    mockRes = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    mockNext = jest.fn();
  });

  // ─── Exported constants ──────────────────────────────────────────────────────

  describe('exported constants', () => {
    it('MAX_IMAGE_SIZE_BYTES equals 5 MB (5 * 1024 * 1024)', () => {
      expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
    });

    it('ALLOWED_IMAGE_MIME_TYPES contains exactly image/png and image/jpeg', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES).toEqual(['image/png', 'image/jpeg']);
    });

    it('INVALID_IMAGE_ERROR has the contract message', () => {
      expect(INVALID_IMAGE_ERROR).toBe('Invalid image. Use PNG, JPG, or JPEG under 5MB.');
    });

    it('IMAGE_NOT_SAVED_ERROR has the contract message', () => {
      expect(IMAGE_NOT_SAVED_ERROR).toBe('Image selected but not saved.');
    });
  });

  // ─── multer configuration (fileFilter) ───────────────────────────────────────

  describe('multer fileFilter', () => {
    const { fileFilter } = multerConfig;

    it('accepts image/png with cb(null, true)', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'image/png' }, cb); // NOSONAR S5693 - testing middleware that uses a reviewed 5 MB limit
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('accepts image/jpeg with cb(null, true)', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'image/jpeg' }, cb); // NOSONAR S5693 - testing middleware that uses a reviewed 5 MB limit
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('rejects image/gif with cb(Error, false)', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'image/gif' }, cb); // NOSONAR S5693 - testing middleware that uses a reviewed 5 MB limit
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
      expect(cb.mock.calls[0][0].message).toBe(INVALID_IMAGE_ERROR);
    });

    it('rejects image/webp with cb(Error, false)', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'image/webp' }, cb); // NOSONAR S5693 - testing middleware that uses a reviewed 5 MB limit
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    });

    it('rejects application/pdf with cb(Error, false)', () => {
      const cb = jest.fn();
      fileFilter({}, { mimetype: 'application/pdf' }, cb); // NOSONAR S5693 - testing middleware that uses a reviewed 5 MB limit
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    });
  });

  // ─── multer limits ────────────────────────────────────────────────────────────

  describe('multer limits', () => {
    it('configures fileSize limit equal to MAX_IMAGE_SIZE_BYTES', () => {
      expect(multerConfig.limits.fileSize).toBe(MAX_IMAGE_SIZE_BYTES);
    });
  });

  // ─── non-multipart request ────────────────────────────────────────────────────

  describe('non-multipart/form-data request', () => {
    beforeEach(() => {
      mockReq.is.mockReturnValue(false);
    });

    it('calls next() immediately without running multer', () => {
      bmEquipmentStatusUpload(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('checks req.is with "multipart/form-data"', () => {
      bmEquipmentStatusUpload(mockReq, mockRes, mockNext);

      expect(mockReq.is).toHaveBeenCalledWith('multipart/form-data');
    });
  });

  // ─── multipart/form-data request ─────────────────────────────────────────────

  describe('multipart/form-data request', () => {
    beforeEach(() => {
      mockReq.is.mockReturnValue(true);
    });

    it('calls next() when multer processes the upload without error', () => {
      multerCallbackError = null;

      bmEquipmentStatusUpload(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('returns 400 with INVALID_IMAGE_ERROR when multer reports a file-size error', () => {
      multerCallbackError = new Error('LIMIT_FILE_SIZE');

      bmEquipmentStatusUpload(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: INVALID_IMAGE_ERROR });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 400 with INVALID_IMAGE_ERROR when multer reports an invalid file-type error', () => {
      multerCallbackError = new Error(INVALID_IMAGE_ERROR);

      bmEquipmentStatusUpload(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith({ error: INVALID_IMAGE_ERROR });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('invokes upload.single with the field name "image"', () => {
      bmEquipmentStatusUpload(mockReq, mockRes, mockNext);

      expect(multerInstance.single).toHaveBeenCalledWith('image');
    });
  });
});
