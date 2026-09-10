jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('../models/certification', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../models/educatorCertification', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const Certification = require('../models/certification');
const EducatorCertification = require('../models/educatorCertification');
const certificationController = require('./certificationController');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (overrides = {}) => ({
  headers: { authorization: 'valid-token' },
  params: {},
  query: {},
  body: {},
  ...overrides,
});

const AUTHORIZED_ROLES = ['Administrator', 'Owner', 'Program Manager', 'Product Manager'];

describe('certificationController', () => {
  const { getAllCertifications, getAllEducatorCertifications, assignOrUpdateCertification } =
    certificationController();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shared authorization behavior', () => {
    it('getAllCertifications returns 401 when authorization header is missing', async () => {
      const req = makeReq({ headers: {} });
      const res = makeRes();

      await getAllCertifications(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authorization token missing' });
      expect(Certification.find).not.toHaveBeenCalled();
    });

    it('getAllCertifications returns 401 when the token is invalid', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('bad token');
      });
      const req = makeReq();
      const res = makeRes();

      await getAllCertifications(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('getAllCertifications returns 403 when the role is not authorized', async () => {
      jwt.verify.mockReturnValue({ role: 'Volunteer' });
      const req = makeReq();
      const res = makeRes();

      await getAllCertifications(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'You are not authorized to access this resource',
      });
      expect(Certification.find).not.toHaveBeenCalled();
    });

    it.each(AUTHORIZED_ROLES)('getAllCertifications allows role %s through', async (role) => {
      jwt.verify.mockReturnValue({ role });
      Certification.find.mockResolvedValue([]);
      const req = makeReq();
      const res = makeRes();

      await getAllCertifications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getAllCertifications', () => {
    beforeEach(() => {
      jwt.verify.mockReturnValue({ role: 'Administrator' });
    });

    it('returns 200 with the list of certifications', async () => {
      const certifications = [{ _id: 'c1', name: 'Food Safety' }];
      Certification.find.mockResolvedValue(certifications);
      const req = makeReq();
      const res = makeRes();

      await getAllCertifications(req, res);

      expect(Certification.find).toHaveBeenCalledWith({});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(certifications);
    });

    it('returns 500 when the query fails', async () => {
      const error = new Error('db down');
      Certification.find.mockRejectedValue(error);
      const req = makeReq();
      const res = makeRes();

      await getAllCertifications(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'db down' });
    });
  });

  describe('getAllEducatorCertifications', () => {
    const buildChain = (records) => {
      const chain = {};
      chain.populate = jest.fn().mockReturnValue(chain);
      chain.sort = jest.fn().mockResolvedValue(records);
      return chain;
    };

    beforeEach(() => {
      jwt.verify.mockReturnValue({ role: 'Administrator' });
    });

    it('returns 401 when unauthorized', async () => {
      const req = makeReq({ headers: {} });
      const res = makeRes();

      await getAllEducatorCertifications(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(EducatorCertification.find).not.toHaveBeenCalled();
    });

    it('queries without a status filter when none is provided', async () => {
      const records = [{ _id: 'e1' }];
      const chain = buildChain(records);
      EducatorCertification.find.mockReturnValue(chain);
      const req = makeReq();
      const res = makeRes();

      await getAllEducatorCertifications(req, res);

      expect(EducatorCertification.find).toHaveBeenCalledWith({});
      expect(chain.populate).toHaveBeenCalledWith('educatorId', 'firstName lastName email');
      expect(chain.populate).toHaveBeenCalledWith('certificationId', 'name description');
      expect(chain.populate).toHaveBeenCalledWith('assignedBy', 'name email');
      expect(chain.sort).toHaveBeenCalledWith({ assignedAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(records);
    });

    it('applies a status filter when provided as a query param', async () => {
      const chain = buildChain([]);
      EducatorCertification.find.mockReturnValue(chain);
      const req = makeReq({ query: { status: 'active' } });
      const res = makeRes();

      await getAllEducatorCertifications(req, res);

      expect(EducatorCertification.find).toHaveBeenCalledWith({ status: 'active' });
    });

    it('returns 500 when the query fails', async () => {
      EducatorCertification.find.mockImplementation(() => {
        throw new Error('query failed');
      });
      const req = makeReq();
      const res = makeRes();

      await getAllEducatorCertifications(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'query failed' });
    });
  });

  describe('assignOrUpdateCertification', () => {
    const educatorId = '68a9f9fa2eec61004e166d8e';
    const certificationId = '69d08c9a65bc4308c78caceb';

    beforeEach(() => {
      jwt.verify.mockReturnValue({ role: 'Administrator', userid: 'assigner1' });
    });

    it('returns 400 when educatorId is missing from params', async () => {
      const req = makeReq({ params: {}, body: { certificationId } });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'educatorId is required' });
    });

    it('returns 401 when the token is missing', async () => {
      const req = makeReq({
        headers: {},
        params: { educatorId },
        body: { certificationId },
      });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 403 when the caller role is not authorized', async () => {
      jwt.verify.mockReturnValue({ role: 'Volunteer', userid: 'assigner1' });
      const req = makeReq({ params: { educatorId }, body: { certificationId } });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(EducatorCertification.findOne).not.toHaveBeenCalled();
    });

    it('returns 404 when certificationId does not match an existing certification', async () => {
      Certification.findById.mockResolvedValue(null);
      const req = makeReq({ params: { educatorId }, body: { certificationId } });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(Certification.findById).toHaveBeenCalledWith(certificationId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Certification not found' });
    });

    it('returns 400 when neither certificationId nor certificationName is provided', async () => {
      const req = makeReq({ params: { educatorId }, body: {} });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Either certificationId or certificationName must be provided',
      });
    });

    it('returns 409 when the certification is already assigned to the educator', async () => {
      const cert = { _id: certificationId, description: '' };
      Certification.findById.mockResolvedValue(cert);
      EducatorCertification.findOne.mockResolvedValue({ _id: 'existing-assignment' });
      const req = makeReq({
        params: { educatorId },
        body: { certificationId, status: 'active', expiryDate: '2026-09-15T00:00:00.000Z' },
      });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(EducatorCertification.findOne).toHaveBeenCalledWith({
        educatorId,
        certificationId: cert._id,
      });
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'This certification is already assigned to the educator',
      });
      expect(EducatorCertification.create).not.toHaveBeenCalled();
    });

    it('creates a new assignment and returns 201 with the populated record', async () => {
      const cert = { _id: certificationId, description: '' };
      const populatedAssignment = { _id: 'assignment1', status: 'active' };
      Certification.findById.mockResolvedValue(cert);
      EducatorCertification.findOne.mockResolvedValue(null);
      const populateFn = jest.fn().mockResolvedValue(populatedAssignment);
      EducatorCertification.create.mockResolvedValue({
        _id: 'assignment1',
        populate: populateFn,
      });
      const req = makeReq({
        params: { educatorId },
        body: { certificationId, status: 'active', expiryDate: '2026-09-15T00:00:00.000Z' },
      });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(EducatorCertification.create).toHaveBeenCalledWith({
        educatorId,
        certificationId: cert._id,
        status: 'active',
        expiryDate: '2026-09-15T00:00:00.000Z',
        assignedBy: 'assigner1',
      });
      expect(populateFn).toHaveBeenCalledWith([
        { path: 'certificationId', select: 'name description' },
        { path: 'assignedBy', select: 'name email' },
      ]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(populatedAssignment);
    });

    it('creates a new certification when certificationName has no existing match', async () => {
      const newCert = { _id: 'newCertId', name: 'New Cert', description: '' };
      Certification.findOne.mockResolvedValue(null);
      Certification.create.mockResolvedValue(newCert);
      EducatorCertification.findOne.mockResolvedValue(null);
      const populateFn = jest.fn().mockResolvedValue({ _id: 'assignment2' });
      EducatorCertification.create.mockResolvedValue({ _id: 'assignment2', populate: populateFn });
      const req = makeReq({
        params: { educatorId },
        body: { certificationName: 'New Cert', status: 'in-progress' },
      });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(Certification.create).toHaveBeenCalledWith({ name: 'New Cert', description: '' });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns 400 when certification lookup fails for a reason unrelated to "not found"', async () => {
      Certification.findById.mockRejectedValue(new Error('unexpected failure'));
      const req = makeReq({ params: { educatorId }, body: { certificationId } });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'unexpected failure' });
    });

    it('returns 500 when an unexpected error occurs outside certification lookup', async () => {
      const cert = { _id: certificationId, description: '' };
      Certification.findById.mockResolvedValue(cert);
      EducatorCertification.findOne.mockRejectedValue(new Error('db failure'));
      const req = makeReq({ params: { educatorId }, body: { certificationId } });
      const res = makeRes();

      await assignOrUpdateCertification(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'db failure' });
    });
  });
});
