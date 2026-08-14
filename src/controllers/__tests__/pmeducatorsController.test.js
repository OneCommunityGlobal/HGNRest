const mockEducatorCountDocuments = jest.fn();
const mockEducatorFindLean = jest.fn();
const mockEducatorFind = jest.fn(() => ({ lean: mockEducatorFindLean }));
const mockEducatorFindById = jest.fn();
const mockEducatorDistinct = jest.fn();

const Educator = {
  countDocuments: mockEducatorCountDocuments,
  find: mockEducatorFind,
  findById: mockEducatorFindById,
  distinct: mockEducatorDistinct,
};
jest.mock('../../models/pmEducators', () => Educator);

const mockStudentCountDocuments = jest.fn();
const mockStudentLean = jest.fn();
const studentChain = {
  populate: jest.fn(() => studentChain),
  sort: jest.fn(() => studentChain),
  skip: jest.fn(() => studentChain),
  limit: jest.fn(() => studentChain),
  lean: mockStudentLean,
};
const mockStudentFind = jest.fn(() => studentChain);

const Student = {
  countDocuments: mockStudentCountDocuments,
  find: mockStudentFind,
};
jest.mock('../../models/pmStudents', () => Student);

const {
  getEducators,
  getEducatorById,
  getStudentsByEducator,
  getSubjects,
  searchStudentsAcrossEducators,
} = require('../pmeducatorsController');

const EDUCATOR_ID = '507f1f77bcf86cd799439011';

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('pmeducatorsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEducators', () => {
    it('returns mock data when there are no educators or no students', async () => {
      mockEducatorCountDocuments.mockResolvedValue(0);
      mockStudentCountDocuments.mockResolvedValue(5);
      const req = {};
      const res = mockRes();

      await getEducators(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ mock: true, data: expect.any(Array) }),
      );
      expect(mockEducatorFind).not.toHaveBeenCalled();
    });

    it('returns real educator data when both collections are populated', async () => {
      mockEducatorCountDocuments.mockResolvedValue(1);
      mockStudentCountDocuments.mockResolvedValue(1);
      mockEducatorFindLean.mockResolvedValue([
        { _id: EDUCATOR_ID, name: 'Alice', subject: 'Math', studentCount: 4 },
      ]);
      const req = {};
      const res = mockRes();

      await getEducators(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [{ id: EDUCATOR_ID, name: 'Alice', subject: 'Math', studentCount: 4 }],
      });
    });

    it('defaults studentCount to 0 when missing', async () => {
      mockEducatorCountDocuments.mockResolvedValue(1);
      mockStudentCountDocuments.mockResolvedValue(1);
      mockEducatorFindLean.mockResolvedValue([{ _id: EDUCATOR_ID, name: 'Bob', subject: 'Sci' }]);
      const req = {};
      const res = mockRes();

      await getEducators(req, res);

      expect(res.json).toHaveBeenCalledWith({
        data: [{ id: EDUCATOR_ID, name: 'Bob', subject: 'Sci', studentCount: 0 }],
      });
    });

    it('returns 500 when the lookup throws', async () => {
      mockEducatorCountDocuments.mockRejectedValue(new Error('db down'));
      const req = {};
      const res = mockRes();

      await getEducators(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch educators' });
    });
  });

  describe('getEducatorById', () => {
    it('returns 400 for an invalid educatorId', async () => {
      const req = { params: { educatorId: 'not-an-id' } };
      const res = mockRes();

      await getEducatorById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid educatorId' });
      expect(mockEducatorFindById).not.toHaveBeenCalled();
    });

    it('returns 404 when the educator is not found', async () => {
      mockEducatorFindById.mockResolvedValue(null);
      const req = { params: { educatorId: EDUCATOR_ID } };
      const res = mockRes();

      await getEducatorById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Educator not found' });
    });

    it('returns the shaped educator with a live student count', async () => {
      mockEducatorFindById.mockResolvedValue({
        _id: EDUCATOR_ID,
        name: 'Alice',
        subject: 'Math',
        toObject() {
          return { _id: EDUCATOR_ID, name: 'Alice', subject: 'Math' };
        },
      });
      mockStudentCountDocuments.mockResolvedValue(3);
      const req = { params: { educatorId: EDUCATOR_ID } };
      const res = mockRes();

      await getEducatorById(req, res);

      expect(mockStudentCountDocuments).toHaveBeenCalledWith({ educator: EDUCATOR_ID });
      expect(res.json).toHaveBeenCalledWith({
        data: { id: EDUCATOR_ID, name: 'Alice', subject: 'Math', studentCount: 3 },
      });
    });

    it('returns 500 when the lookup throws', async () => {
      mockEducatorFindById.mockRejectedValue(new Error('db down'));
      const req = { params: { educatorId: EDUCATOR_ID } };
      const res = mockRes();

      await getEducatorById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch educator' });
    });
  });

  describe('getStudentsByEducator', () => {
    it('returns mocked students for a known mock educator in mock mode', async () => {
      mockEducatorCountDocuments.mockResolvedValue(0);
      mockStudentCountDocuments.mockResolvedValue(0);
      const req = { params: { educatorId: 't-001' } };
      const res = mockRes();

      await getStudentsByEducator(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Array) }));
      expect(res.json.mock.calls[0][0].data.length).toBeGreaterThan(0);
    });

    it('returns an empty array in mock mode for an unknown educatorId', async () => {
      mockEducatorCountDocuments.mockResolvedValue(0);
      mockStudentCountDocuments.mockResolvedValue(0);
      const req = { params: { educatorId: 'unknown-id' } };
      const res = mockRes();

      await getStudentsByEducator(req, res);

      expect(res.json).toHaveBeenCalledWith({ data: [] });
    });

    it('returns real students in real mode', async () => {
      mockEducatorCountDocuments.mockResolvedValue(1);
      mockStudentCountDocuments.mockResolvedValue(1);
      mockStudentLean.mockResolvedValue([{ _id: 's1', name: 'Jay', grade: '7' }]);
      const req = { params: { educatorId: EDUCATOR_ID } };
      const res = mockRes();

      await getStudentsByEducator(req, res);

      expect(mockStudentFind).toHaveBeenCalledWith({ educator: EDUCATOR_ID });
      expect(res.json).toHaveBeenCalledWith({ data: [{ _id: 's1', name: 'Jay', grade: '7' }] });
    });

    it('returns 500 when the lookup throws', async () => {
      mockEducatorCountDocuments.mockRejectedValue(new Error('db down'));
      const req = { params: { educatorId: EDUCATOR_ID } };
      const res = mockRes();

      await getStudentsByEducator(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch students' });
    });
  });

  describe('getSubjects', () => {
    it('returns sorted subjects with a total', async () => {
      mockEducatorDistinct.mockResolvedValue(['Science', 'Math']);
      const res = mockRes();

      await getSubjects({}, res);

      expect(res.json).toHaveBeenCalledWith({ data: ['Math', 'Science'], total: 2 });
    });

    it('returns 500 when distinct() throws', async () => {
      mockEducatorDistinct.mockRejectedValue(new Error('db down'));
      const res = mockRes();

      await getSubjects({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch subjects' });
    });
  });

  describe('searchStudentsAcrossEducators', () => {
    it('searches with no filters using default pagination', async () => {
      mockStudentCountDocuments.mockResolvedValue(0);
      mockStudentLean.mockResolvedValue([]);
      const req = { query: {} };
      const res = mockRes();

      await searchStudentsAcrossEducators(req, res);

      expect(mockStudentCountDocuments).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        data: [],
        page: 1,
        totalPages: 1,
        total: 0,
        filters: { q: '' },
      });
    });

    it('filters by name using a case-insensitive regex', async () => {
      mockStudentCountDocuments.mockResolvedValue(1);
      mockStudentLean.mockResolvedValue([
        {
          _id: 's1',
          name: 'Jay',
          grade: '7',
          progress: 0.5,
          educator: { _id: EDUCATOR_ID, name: 'Alice', subject: 'Math' },
        },
      ]);
      const req = { query: { q: 'jay' } };
      const res = mockRes();

      await searchStudentsAcrossEducators(req, res);

      expect(mockStudentCountDocuments).toHaveBeenCalledWith({
        name: { $regex: 'jay', $options: 'i' },
      });
      expect(res.json).toHaveBeenCalledWith({
        data: [
          {
            id: 's1',
            name: 'Jay',
            grade: '7',
            progress: 0.5,
            educatorId: EDUCATOR_ID,
            educatorName: 'Alice',
            subject: 'Math',
          },
        ],
        page: 1,
        totalPages: 1,
        total: 1,
        filters: { q: 'jay' },
      });
    });

    it('shapes a student with no populated educator using null fields', async () => {
      mockStudentCountDocuments.mockResolvedValue(1);
      mockStudentLean.mockResolvedValue([
        { _id: 's2', name: 'Kate', grade: '8', progress: 0.2, educator: null },
      ]);
      const req = { query: {} };
      const res = mockRes();

      await searchStudentsAcrossEducators(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            expect.objectContaining({
              educatorId: null,
              educatorName: null,
              subject: null,
            }),
          ],
        }),
      );
    });

    it('clamps the requested page to the last available page', async () => {
      mockStudentCountDocuments.mockResolvedValue(0);
      mockStudentLean.mockResolvedValue([]);
      const req = { query: { page: '5', limit: '10' } };
      const res = mockRes();

      await searchStudentsAcrossEducators(req, res);

      expect(studentChain.skip).toHaveBeenCalledWith(0);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ page: 1, totalPages: 1 }));
    });

    it('returns 500 when the search throws', async () => {
      mockStudentCountDocuments.mockRejectedValue(new Error('db down'));
      const req = { query: {} };
      const res = mockRes();

      await searchStudentsAcrossEducators(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to search students' });
    });
  });
});
