const mockAggregate = jest.fn();

jest.mock('../../../models/progress', () => ({
  aggregate: (...args) => mockAggregate(...args),
}));

const { getKnowledgeEvolution } = require('../knowledgeEvolutionController');

describe('knowledgeEvolutionController', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {}, body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('returns 400 when studentId is missing from both query and requestor', async () => {
    await getKnowledgeEvolution(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'studentId is required' });
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it('fetches knowledge evolution data using studentId from the query string', async () => {
    const studentId = '64a1b2c3d4e5f6789012345d';
    const aggregateResult = [
      {
        _id: '68def3a5f0844c6916607a94',
        subjectName: 'Mathematics',
        atoms: [
          {
            atomId: '68f963efd7236176fd021de0',
            atomName: 'Basic Addition Test',
            color: 'beginner',
            atomStatus: 'completed',
          },
        ],
        totalAtoms: 1,
        completedAtoms: 1,
        inProgressAtoms: 0,
      },
    ];
    mockAggregate.mockResolvedValue(aggregateResult);
    req.query.studentId = studentId;

    await getKnowledgeEvolution(req, res);

    expect(mockAggregate).toHaveBeenCalledTimes(1);
    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline[0].$match.studentId.toString()).toBe(studentId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      studentId,
      message: 'Knowledge evolution data fetched successfully',
      totalSubjects: aggregateResult.length,
      knowledgeEvolution: aggregateResult,
    });
  });

  it('returns 400 when studentId is missing from the query even if req.body.requestor is set', async () => {
    req.body.requestor = { requestorId: '64a1b2c3d4e5f6789012345d' };

    await getKnowledgeEvolution(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'studentId is required' });
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it('returns 400 when studentId is not a valid ObjectId', async () => {
    req.query.studentId = 'not-a-valid-id';

    await getKnowledgeEvolution(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'studentId is not a valid ObjectId' });
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it('returns 500 when the aggregation fails', async () => {
    req.query.studentId = '64a1b2c3d4e5f6789012345d';
    mockAggregate.mockRejectedValue(new Error('aggregation exploded'));

    await getKnowledgeEvolution(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error fetching learner knowledge evolution data',
      error: 'aggregation exploded',
    });
  });
});
