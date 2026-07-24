jest.mock('../../controllers/educationTaskReviewController', () =>
  jest.fn(() => ({
    getSubmissionForReview: jest.fn(),
    saveReviewProgress: jest.fn(),
    addPageComment: jest.fn(),
    updatePageComment: jest.fn(),
    deletePageComment: jest.fn(),
    submitFinalReview: jest.fn(),
  })),
);

describe('educationTaskReviewRoutes', () => {
  test('registers all review endpoints', () => {
    jest.isolateModules(() => {
      const router = require('../educationTaskReviewRoutes');
      const paths = router.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(paths).toEqual(
        expect.arrayContaining([
          { path: '/review/:submissionId', methods: ['get'] },
          { path: '/review/:submissionId/progress', methods: ['post'] },
          { path: '/review/:submissionId/comments', methods: ['post'] },
          { path: '/review/:submissionId/comments/:commentId', methods: ['put'] },
          { path: '/review/:submissionId/comments/:commentId', methods: ['delete'] },
          { path: '/review/:submissionId/submit', methods: ['post'] },
        ]),
      );
    });
  });
});
