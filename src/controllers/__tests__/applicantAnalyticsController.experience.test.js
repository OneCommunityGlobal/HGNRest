const analyticsController = require('../applicantAnalyticsController');

const profileAnswer = (profile) => ({
  questionId: 'p',
  answer: { type: 'applicantProfile', ...profile },
});
const application = (profile, submittedAt = '2026-09-15T12:00:00Z') => ({
  submittedAt: new Date(submittedAt),
  answers: [{ questionId: 'q1', answer: 'yes' }, profileAnswer(profile)],
});

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const admin = { requestor: { role: 'Administrator' } };
// Only the applicant's profile answer is loaded, not every free-text answer
const PROFILE_PROJECTION = {
  submittedAt: 1,
  answers: { $elemMatch: { 'answer.type': 'applicantProfile' } },
};

describe('getExperienceBreakdown', () => {
  let JobApplication;
  let controller;
  let res;

  const givenApplications = (docs) => {
    JobApplication.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(docs) });
  };

  beforeEach(() => {
    JobApplication = { find: jest.fn() };
    controller = analyticsController({}, {}, {}, {}, JobApplication);
    res = createMockRes();
  });

  it('buckets real job applications by years of full-time experience', async () => {
    givenApplications([
      application({ jobTitle: 'Software Engineer', fullTimeYears: '0.5' }),
      application({ jobTitle: 'Software Engineer', fullTimeYears: '1' }),
      application({ jobTitle: 'UX Designer', fullTimeYears: '2 years' }),
      application({ jobTitle: 'UX Designer', fullTimeYears: '4' }),
      application({ jobTitle: 'Project Manager', fullTimeYears: '5+' }),
      application({ jobTitle: 'Project Manager', fullTimeYears: '12' }),
    ]);

    await controller.getExperienceBreakdown({ body: admin, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      total: 6,
      notReported: 0,
      breakdown: [
        { experience: '0-1 years', count: 2, percentage: 33.3 },
        { experience: '1-3 years', count: 1, percentage: 16.7 },
        { experience: '3-5 years', count: 1, percentage: 16.7 },
        { experience: '5+ years', count: 2, percentage: 33.3 },
      ],
    });
  });

  it('filters by inclusive submission dates', async () => {
    givenApplications([]);

    await controller.getExperienceBreakdown(
      { body: admin, query: { startDate: '2026-09-01', endDate: '2026-09-30' } },
      res,
    );

    expect(JobApplication.find).toHaveBeenCalledWith(
      {
        submittedAt: {
          $gte: new Date('2026-09-01T00:00:00.000Z'),
          $lte: new Date('2026-09-30T23:59:59.999Z'),
        },
      },
      PROFILE_PROJECTION,
    );
  });

  it('uses exact instants when the client sends its local day bounds', async () => {
    givenApplications([]);

    await controller.getExperienceBreakdown(
      {
        body: admin,
        query: { startDate: '2026-09-01T07:00:00.000Z', endDate: '2026-10-01T06:59:59.999Z' },
      },
      res,
    );

    expect(JobApplication.find).toHaveBeenCalledWith(
      {
        submittedAt: {
          $gte: new Date('2026-09-01T07:00:00.000Z'),
          $lte: new Date('2026-10-01T06:59:59.999Z'),
        },
      },
      PROFILE_PROJECTION,
    );
  });

  it.each([
    [{ startDate: '2026-13-45' }, 'startDate must be a valid date (YYYY-MM-DD or ISO date-time).'],
    [{ endDate: 'yesterday' }, 'endDate must be a valid date (YYYY-MM-DD or ISO date-time).'],
    [{ startDate: '2026-10-02', endDate: '2026-10-01' }, 'startDate must be on or before endDate.'],
  ])('rejects an invalid date range %p', async (query, error) => {
    await controller.getExperienceBreakdown({ body: admin, query }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error });
    expect(JobApplication.find).not.toHaveBeenCalled();
  });

  it('only counts applicants for the selected roles, ignoring case', async () => {
    givenApplications([
      application({ jobTitle: 'Software Engineer', fullTimeYears: '2' }),
      application({ jobTitle: 'UX Designer', fullTimeYears: '7' }),
      application({ jobTitle: 'Project Manager', fullTimeYears: '0' }),
    ]);

    await controller.getExperienceBreakdown(
      { body: admin, query: { roles: 'software engineer,UX Designer' } },
      res,
    );

    expect(res.json).toHaveBeenCalledWith({
      total: 2,
      notReported: 0,
      breakdown: [
        { experience: '0-1 years', count: 0, percentage: 0 },
        { experience: '1-3 years', count: 1, percentage: 50 },
        { experience: '3-5 years', count: 0, percentage: 0 },
        { experience: '5+ years', count: 1, percentage: 50 },
      ],
    });
  });

  it('matches role titles that contain commas when roles arrive as a list', async () => {
    givenApplications([
      application({ jobTitle: 'Software Engineer, Frontend', fullTimeYears: '2' }),
      application({ jobTitle: 'Software Engineer', fullTimeYears: '7' }),
    ]);

    await controller.getExperienceBreakdown(
      { body: admin, query: { roles: ['Software Engineer, Frontend'] } },
      res,
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('reports applicants without usable years separately instead of guessing', async () => {
    givenApplications([
      application({ jobTitle: 'Software Engineer', fullTimeYears: '3' }),
      application({ jobTitle: 'Software Engineer', fullTimeYears: '' }),
      application({ jobTitle: 'Software Engineer', fullTimeYears: 'a few' }),
      application({ jobTitle: 'Software Engineer' }),
      { submittedAt: new Date(), answers: [{ questionId: 'q1', answer: 'no profile' }] },
    ]);

    await controller.getExperienceBreakdown({ body: admin, query: {} }, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1, notReported: 4 }));
  });

  const bucketFor = async (fullTimeYears) => {
    givenApplications([application({ jobTitle: 'Software Engineer', fullTimeYears })]);
    await controller.getExperienceBreakdown({ body: admin, query: {} }, res);
    const { breakdown, notReported } = res.json.mock.calls[0][0];
    if (notReported) return 'not reported';
    return breakdown.find((b) => b.count === 1).experience;
  };

  it.each([
    ['2', '1-3 years'],
    [' 4 Years ', '3-5 years'],
    ['2 yrs', '1-3 years'],
    ['3.5', '3-5 years'],
    ['5+', '5+ years'],
    ['5+ yrs', '5+ years'],
    ['5 + years', '5+ years'],
    ['10+ years', '5+ years'],
    ['6 months', '0-1 years'],
    ['18 months', '1-3 years'],
    ['0-1', '0-1 years'],
    ['1-3 years', '1-3 years'],
    ['3 - 5 years', '3-5 years'],
    ['3–5 years', '3-5 years'],
    ['5-10 years', '5+ years'],
  ])('reads the answer "%s" as %s', async (answer, bucket) => {
    expect(await bucketFor(answer)).toBe(bucket);
  });

  it.each(['1,5', '1e3', 'about 3', 'three', 'N/A', '-2', '200', 'Infinity', '5-3 years'])(
    'counts the unclear answer "%s" as not reported instead of guessing',
    async (answer) => {
      expect(await bucketFor(answer)).toBe('not reported');
    },
  );

  it.each([
    ['startDate', '2026-02-30'],
    ['startDate', '2026-02-30T00:00:00Z'],
    ['endDate', '2026-02-28T24:00:00Z'],
  ])('rejects the impossible %s %s', async (param, value) => {
    await controller.getExperienceBreakdown({ body: admin, query: { [param]: value } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(JobApplication.find).not.toHaveBeenCalled();
  });

  it('rejects a roles filter that is not a list of titles (400, not a crash)', async () => {
    await controller.getExperienceBreakdown({ body: admin, query: { roles: [{ a: '1' }] } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'roles must be a list of job titles.' });
  });

  it('returns an empty breakdown (not an error) when nothing matches', async () => {
    givenApplications([]);

    await controller.getExperienceBreakdown({ body: admin, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ breakdown: [], total: 0, notReported: 0 });
  });

  it('denies users who are not an Owner or Administrator', async () => {
    await controller.getExperienceBreakdown(
      { body: { requestor: { role: 'Volunteer' } }, query: {} },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(JobApplication.find).not.toHaveBeenCalled();
  });
});

describe('getAllRoles', () => {
  it('lists the distinct job titles applicants applied for, sorted', async () => {
    const JobApplication = {
      find: jest.fn().mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            application({ jobTitle: 'UX Designer' }),
            application({ jobTitle: 'Software Engineer' }),
            application({ jobTitle: 'software engineer ' }),
            application({ jobTitle: '' }),
            { answers: [] },
          ]),
      }),
    };
    const res = createMockRes();

    await analyticsController({}, {}, {}, {}, JobApplication).getAllRoles({ body: admin }, res);

    expect(JobApplication.find).toHaveBeenCalledWith({}, PROFILE_PROJECTION);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(['Software Engineer', 'UX Designer']);
  });

  it('denies users who are not an Owner or Administrator', async () => {
    const JobApplication = { find: jest.fn() };
    const res = createMockRes();

    await analyticsController({}, {}, {}, {}, JobApplication).getAllRoles(
      { body: { requestor: { role: 'Volunteer' } } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(JobApplication.find).not.toHaveBeenCalled();
  });
});
