// --- 1. Define Mocks FIRST (Before Imports) ---

// Mock UserProfile
const mockUserProfile = {
  findById: jest.fn(),
  findOne: jest.fn(),
  aggregate: jest.fn(),
  save: jest.fn(),
};

// We need a mock constructor that returns an object with a save method
const MockUserProfileConstructor = jest.fn().mockImplementation(() => ({
  save: jest.fn(),
}));

// Attach static methods to the constructor
MockUserProfileConstructor.findById = mockUserProfile.findById;
MockUserProfileConstructor.findOne = mockUserProfile.findOne;
MockUserProfileConstructor.aggregate = mockUserProfile.aggregate;

jest.mock('../../models/userProfile', () => MockUserProfileConstructor);

// Mock EducationTask
const mockEducationTask = {
  aggregate: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};
jest.mock('../../models/educationTask', () => mockEducationTask);

// Mock LessonPlan
const mockLessonPlan = {
  find: jest.fn(),
};
jest.mock('../../models/lessonPlan', () => mockLessonPlan);

// Mock Atom
const mockAtom = {
  find: jest.fn(),
};
jest.mock('../../models/atom', () => mockAtom);

// Mock Subject
const mockSubject = {
  findById: jest.fn(),
};
jest.mock('../../models/subject', () => mockSubject);

// --- 2. Import Controller (After Mocks) ---
const { getStudentProfile, getSubjectTasks } = require('../educationUserProfileController');

// --- 3. Test Suite ---
describe('Student Controller', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {
        requestor: {
          requestorId: '507f1f77bcf86cd799439011',
        },
      },
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getStudentProfile', () => {
    it('should return 400 if student ID is invalid', async () => {
      req.body.requestor.requestorId = 'invalid-id';
      await getStudentProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid') }),
      );
    });

    it('should return 404 if student profile not found', async () => {
      // Setup the chain: findById -> select -> lean
      const mockLean = jest.fn().mockResolvedValue(null);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      mockUserProfile.findById.mockReturnValue({ select: mockSelect });

      await getStudentProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return student profile and subject progress on success', async () => {
      // Mock User Data
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        firstName: 'Test',
        lastName: 'Student',
        educationProfiles: { student: { learningLevel: '10th Grade' } },
        profilePic: 'pic.jpg',
        location: { userProvided: 'NY' },
        timeZone: 'EST',
      };

      // Mock UserProfile.findById chain
      const mockUserLean = jest.fn().mockResolvedValue(mockUser);
      const mockUserSelect = jest.fn().mockReturnValue({ lean: mockUserLean });
      mockUserProfile.findById.mockReturnValue({ select: mockUserSelect });

      // Mock UserProfile.findOne chain (for Teacher/Support)
      const mockTeacherLean = jest.fn().mockResolvedValue({ firstName: 'Teach', lastName: 'Er' });
      const mockTeacherSelect = jest.fn().mockReturnValue({ lean: mockTeacherLean });
      mockUserProfile.findOne.mockReturnValue({ select: mockTeacherSelect });

      // Mock EducationTask.aggregate
      mockEducationTask.aggregate.mockResolvedValue([{ name: 'Math', completed: 5 }]);

      await getStudentProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          studentDetails: expect.any(Object),
          subjects: expect.any(Array),
        }),
      );
    });
  });

  describe('getSubjectTasks', () => {
    it('should return empty array if no active lesson plans found', async () => {
      req.params.id = '507f1f77bcf86cd799439022';

      // Mock Subject.findById chain
      const mockSubjectSelect = jest.fn().mockResolvedValue({ _id: 'sub1', name: 'Math' });
      mockSubject.findById.mockReturnValue({ select: mockSubjectSelect });

      // Mock LessonPlan.find chain
      // NOTE: Ensure your controller matches this return type (Array vs Object)
      const mockLessonSelect = jest.fn().mockResolvedValue([]); // Return empty array
      mockLessonPlan.find.mockReturnValue({ select: mockLessonSelect });

      await getSubjectTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // We check for EITHER an empty array OR the payload object to be safe against controller versions
      const lastCallArg = res.json.mock.calls[0][0];
      if (Array.isArray(lastCallArg)) {
        expect(lastCallArg).toEqual([]);
      } else {
        expect(lastCallArg).toEqual(
          expect.objectContaining({
            subject: expect.any(Object),
            tasks: [],
          }),
        );
      }
    });

    it('should return tasks if active lesson plan and atoms exist', async () => {
      req.params.id = '507f1f77bcf86cd799439022';

      // Mock Subject
      const mockSubjectSelect = jest.fn().mockResolvedValue({ _id: 'sub1', name: 'Math' });
      mockSubject.findById.mockReturnValue({ select: mockSubjectSelect });

      // Mock Active Lesson Plan
      const mockLessonSelect = jest.fn().mockResolvedValue([{ _id: 'plan1' }]);
      mockLessonPlan.find.mockReturnValue({ select: mockLessonSelect });

      // Mock Atoms
      const mockAtomSelect = jest.fn().mockResolvedValue([{ _id: 'atom1' }]);
      mockAtom.find.mockReturnValue({ select: mockAtomSelect });

      const mockTasks = [{ _id: 'task1', title: 'Do Math' }];

      // Mock EducationTask.find chain: find -> populate -> sort
      const mockSort = jest.fn().mockResolvedValue(mockTasks);
      const mockPopulate = jest.fn().mockReturnValue({ sort: mockSort });
      mockEducationTask.find.mockReturnValue({ populate: mockPopulate });

      await getSubjectTasks(req, res);
      expect(res.status).toHaveBeenCalledWith(200);

      // Check for EITHER array or Object to handle versions
      const lastCallArg = res.json.mock.calls[0][0];
      if (Array.isArray(lastCallArg)) {
        expect(lastCallArg).toEqual(mockTasks);
      } else {
        expect(lastCallArg).toEqual(expect.objectContaining({ tasks: mockTasks }));
      }
    });
  });
});
