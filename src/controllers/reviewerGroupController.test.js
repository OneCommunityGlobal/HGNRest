jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const { DEFAULT_REVIEWER_GROUPS } = require('../helpers/reviewerGroupHelper');
const reviewerGroupController = require('./reviewerGroupController');

const OWNER_ID = '665234c757ca141fe891e1ca';

const storedGroups = () => [
  {
    key: 'all',
    label: 'All Members',
    rangeStart: null,
    rangeEnd: null,
    editable: false,
    sortOrder: 0,
  },
  {
    key: '95xx',
    label: '95XXPRT Members',
    rangeStart: 'A',
    rangeEnd: 'N',
    editable: true,
    sortOrder: 1,
  },
  {
    key: '97xx',
    label: '97XXPRT Members',
    rangeStart: 'O',
    rangeEnd: 'Z',
    editable: true,
    sortOrder: 2,
  },
];

describe('reviewerGroupController', () => {
  let ReviewerGroup;
  let controller;
  let mockRes;
  let found;

  const respondWith = (docs) => {
    found = docs;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    respondWith(storedGroups());

    ReviewerGroup = {
      find: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(found)) })),
      bulkWrite: jest.fn().mockResolvedValue({}),
      create: jest.fn((doc) => Promise.resolve(doc)),
      findOneAndUpdate: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(null)) })),
    };
    controller = reviewerGroupController(ReviewerGroup);

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    hasPermission.mockResolvedValue(true);
  });

  const ownerReq = (body = {}, params = {}) => ({
    params,
    body: { requestor: { requestorId: OWNER_ID, role: 'Owner' }, ...body },
  });

  describe('getReviewerGroups', () => {
    it('refuses a requestor without getReports, matching the dashboard read', async () => {
      hasPermission.mockResolvedValue(false);

      await controller.getReviewerGroups(ownerReq(), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(ReviewerGroup.find).not.toHaveBeenCalled();
    });

    it('returns the stored groups in dropdown order', async () => {
      respondWith([storedGroups()[2], storedGroups()[0], storedGroups()[1]]);

      await controller.getReviewerGroups(ownerReq(), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const [payload] = mockRes.json.mock.calls[0];
      expect(payload.groups.map((g) => g.key)).toEqual(['all', '95xx', '97xx']);
    });

    it('seeds the three default groups when the collection is empty', async () => {
      let calls = 0;
      ReviewerGroup.find = jest.fn(() => ({
        lean: jest.fn(() => {
          calls += 1;
          return Promise.resolve(calls === 1 ? [] : storedGroups());
        }),
      }));

      await controller.getReviewerGroups(ownerReq(), mockRes);

      expect(ReviewerGroup.bulkWrite).toHaveBeenCalledTimes(1);
      const [operations] = ReviewerGroup.bulkWrite.mock.calls[0];
      expect(operations.map((op) => op.updateOne.filter.key)).toEqual(
        DEFAULT_REVIEWER_GROUPS.map((g) => g.key),
      );
      expect(operations.every((op) => op.updateOne.upsert === true)).toBe(true);

      const [payload] = mockRes.json.mock.calls[0];
      expect(payload.groups).toHaveLength(3);
    });

    it('does not re-seed when groups already exist', async () => {
      await controller.getReviewerGroups(ownerReq(), mockRes);

      expect(ReviewerGroup.bulkWrite).not.toHaveBeenCalled();
    });

    it('reports coverage warnings alongside the groups', async () => {
      const groups = storedGroups();
      groups[1].rangeEnd = 'K';
      respondWith(groups);

      await controller.getReviewerGroups(ownerReq(), mockRes);

      const [payload] = mockRes.json.mock.calls[0];
      expect(payload.warnings).toEqual(['No group covers L-N']);
    });

    it('500s and logs when the read fails', async () => {
      ReviewerGroup.find = jest.fn(() => ({
        lean: jest.fn(() => Promise.reject(new Error('mongo is down'))),
      }));

      await controller.getReviewerGroups(ownerReq(), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(logger.logException).toHaveBeenCalled();
    });
  });

  describe('createReviewerGroup', () => {
    const validBody = { label: '99XXPRT Members', rangeStart: 'a', rangeEnd: 'c' };

    it.each(['Administrator', 'Manager', 'Core Team', 'Volunteer'])(
      'refuses a %s, since the spec limits adding groups to the Owner',
      async (role) => {
        const req = ownerReq(validBody);
        req.body.requestor.role = role;

        await controller.createReviewerGroup(req, mockRes);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(ReviewerGroup.create).not.toHaveBeenCalled();
      },
    );

    it.each([undefined, '', '   ', 42])('rejects %p as a label', async (label) => {
      await controller.createReviewerGroup(ownerReq({ ...validBody, label }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(ReviewerGroup.create).not.toHaveBeenCalled();
    });

    it('rejects a label that slugs to nothing usable', async () => {
      await controller.createReviewerGroup(ownerReq({ ...validBody, label: '!!!' }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(ReviewerGroup.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid range', async () => {
      await controller.createReviewerGroup(
        ownerReq({ ...validBody, rangeStart: 'N', rangeEnd: 'A' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(ReviewerGroup.create).not.toHaveBeenCalled();
    });

    it('creates an editable group with a normalised range and a derived key', async () => {
      await controller.createReviewerGroup(ownerReq(validBody), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      const [doc] = ReviewerGroup.create.mock.calls[0];
      expect(doc).toMatchObject({
        key: '99xxprt-members',
        label: '99XXPRT Members',
        rangeStart: 'A',
        rangeEnd: 'C',
        editable: true,
      });
    });

    it('puts the new group last in the dropdown', async () => {
      await controller.createReviewerGroup(ownerReq(validBody), mockRes);

      const [doc] = ReviewerGroup.create.mock.calls[0];
      expect(doc.sortOrder).toBe(3);
    });

    it('derives a non-colliding key when the label matches an existing group', async () => {
      await controller.createReviewerGroup(
        ownerReq({ ...validBody, label: '95XXPRT Members' }),
        mockRes,
      );

      const [doc] = ReviewerGroup.create.mock.calls[0];
      expect(doc.key).toBe('95xxprt-members');
      expect(doc.key).not.toBe('95xx');
    });

    it('warns about the overlap the new group introduces rather than refusing it', async () => {
      await controller.createReviewerGroup(ownerReq(validBody), mockRes);

      const [payload] = mockRes.json.mock.calls[0];
      expect(payload.warnings.join(' ')).toContain('A-C');
    });
  });

  describe('updateReviewerGroup', () => {
    const updated = {
      key: '95xx',
      label: 'Renamed',
      rangeStart: 'A',
      rangeEnd: 'N',
      editable: true,
      sortOrder: 1,
    };

    beforeEach(() => {
      ReviewerGroup.findOneAndUpdate = jest.fn(() => ({
        lean: jest.fn(() => Promise.resolve(updated)),
      }));
    });

    it('refuses anyone who is not an Owner', async () => {
      const req = ownerReq({ label: 'Renamed' }, { groupKey: '95xx' });
      req.body.requestor.role = 'Administrator';

      await controller.updateReviewerGroup(req, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(ReviewerGroup.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('refuses to edit All Members, which is locked by design', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ label: 'Everyone' }, { groupKey: 'all' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(ReviewerGroup.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('404s for a group key that does not exist', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ label: 'Renamed' }, { groupKey: 'nope' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(ReviewerGroup.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('400s when neither a label nor a range is supplied', async () => {
      await controller.updateReviewerGroup(ownerReq({}, { groupKey: '95xx' }), mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(ReviewerGroup.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('renames without touching the range', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ label: 'Renamed' }, { groupKey: '95xx' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const [filter, update] = ReviewerGroup.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ key: '95xx' });
      expect(update.$set.label).toBe('Renamed');
      expect(update.$set).not.toHaveProperty('rangeStart');
    });

    it('keeps the key stable across a rename, since the frontend filters by it', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ label: 'Something Else Entirely' }, { groupKey: '95xx' }),
        mockRes,
      );

      const [, update] = ReviewerGroup.findOneAndUpdate.mock.calls[0];
      expect(update.$set).not.toHaveProperty('key');
    });

    it('edits the range without touching the label', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ rangeStart: 'a', rangeEnd: 'p' }, { groupKey: '95xx' }),
        mockRes,
      );

      const [, update] = ReviewerGroup.findOneAndUpdate.mock.calls[0];
      expect(update.$set).toMatchObject({ rangeStart: 'A', rangeEnd: 'P' });
      expect(update.$set).not.toHaveProperty('label');
    });

    it('rejects an invalid range', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ rangeStart: 'P', rangeEnd: 'B' }, { groupKey: '95xx' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(ReviewerGroup.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rejects a half-supplied range rather than storing one boundary', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ rangeStart: 'A' }, { groupKey: '95xx' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(ReviewerGroup.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('allows an overlap and warns, so a range can be widened before the neighbour shrinks', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ rangeStart: 'A', rangeEnd: 'P' }, { groupKey: '95xx' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const [payload] = mockRes.json.mock.calls[0];
      expect(payload.warnings.join(' ')).toContain('O-P');
    });

    it('records who made the edit', async () => {
      await controller.updateReviewerGroup(
        ownerReq({ label: 'Renamed' }, { groupKey: '95xx' }),
        mockRes,
      );

      const [, update] = ReviewerGroup.findOneAndUpdate.mock.calls[0];
      expect(update.$set.updatedBy).toBe(OWNER_ID);
      expect(update.$set.updatedAt).toBeInstanceOf(Date);
    });

    it('500s and logs when the write fails', async () => {
      ReviewerGroup.findOneAndUpdate = jest.fn(() => ({
        lean: jest.fn(() => Promise.reject(new Error('mongo is down'))),
      }));

      await controller.updateReviewerGroup(
        ownerReq({ label: 'Renamed' }, { groupKey: '95xx' }),
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(logger.logException).toHaveBeenCalled();
    });
  });
});
