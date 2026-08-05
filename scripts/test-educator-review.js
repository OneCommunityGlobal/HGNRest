/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../src/config');
const EducationTask = require('../src/models/educationTask');
const LessonPlan = require('../src/models/lessonPlan');
const UserProfile = require('../src/models/userProfile');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:4500';

const connect = async () => {
  const appName = process.env.appName || 'HGNRest';
  const uri = `mongodb+srv://${encodeURIComponent(process.env.user)}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?retryWrites=true&w=majority&appName=${appName}`;
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

const makeToken = (user) =>
  jwt.sign(
    {
      userid: user._id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      permissions: user.permissions,
      access: { canAccessBMPortal: false },
      email: user.email,
      expiryTimestamp: moment().add(config.TOKEN.Lifetime, config.TOKEN.Units).toISOString(),
    },
    config.JWT_SECRET,
  );

const request = async (method, path, token, body) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = token;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: res.status, json };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

(async () => {
  const results = [];
  let submissionId;
  let commentId;
  let token;
  let reviewerId;

  try {
    await connect();
    console.log('Connected to DB:', mongoose.connection.name);

    const reviewer =
      (await UserProfile.findOne({ role: { $in: ['Owner', 'Administrator'] }, isActive: true })) ||
      (await UserProfile.findOne({ isActive: true }));
    assert(reviewer, 'No active user found for JWT');
    reviewerId = reviewer._id.toString();
    token = makeToken(reviewer);
    console.log(`Using reviewer: ${reviewer.firstName} ${reviewer.lastName} (${reviewer.role})`);

    // Prefer an existing submitted/reviewable task; otherwise seed one
    let task = await EducationTask.findOne({
      status: { $in: ['submitted', 'in_review', 'changes_requested', 'graded', 'completed'] },
    }).sort({ updatedAt: -1 });

    if (!task) {
      console.log('No reviewable task found — seeding one...');
      let lessonPlan = await LessonPlan.findOne();
      if (!lessonPlan) {
        lessonPlan = await LessonPlan.create({
          title: 'Review Workflow Test Lesson',
          description: 'Seeded for educator document review API tests',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdBy: reviewer._id,
        });
      }

      const student =
        (await UserProfile.findOne({
          _id: { $ne: reviewer._id },
          isActive: true,
          firstName: { $exists: true, $ne: '' },
        })) || reviewer;

      task = await EducationTask.create({
        name: 'Short Story Brainstorm',
        lessonPlanId: lessonPlan._id,
        studentId: student._id,
        atomIds: [],
        type: 'write',
        weightage: 20,
        status: 'submitted',
        reviewStatus: 'pending_review',
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(),
        uploadUrls: ['https://example.com/placeholder/submission.pdf'],
        totalMarks: 100,
        grade: 'pending',
      });
      console.log('Seeded task:', task._id.toString());
    } else {
      // Ensure task is in a reviewable state for a clean test run
      // Legacy docs may lack required `name` — set a fallback before save
      if (!task.name) {
        task.name = 'Short Story Brainstorm';
      }
      task.status = 'submitted';
      task.reviewStatus = 'pending_review';
      task.grade = 'pending';
      task.marksGiven = undefined;
      task.collaborativeFeedback = '';
      task.privateNotes = '';
      task.pageComments = [];
      task.changeRequests = [];
      task.draftSaved = false;
      task.reviewedAt = undefined;
      task.completedAt = undefined;
      task.reviewedBy = undefined;
      if (!task.submittedAt) task.submittedAt = new Date();
      if (!task.uploadUrls || task.uploadUrls.length === 0) {
        task.uploadUrls = ['https://example.com/placeholder/submission.pdf'];
      }
      await task.save();
      console.log('Reset existing task for testing:', task._id.toString());
    }

    submissionId = task._id.toString();

    // Test 8 first: missing auth
    {
      const r = await request('GET', `/api/educationportal/educator/review/${submissionId}`);
      results.push({
        test: '8 Missing auth',
        pass: r.status === 401,
        status: r.status,
        body: r.json,
      });
    }

    // Test 1: Fetch submission
    {
      const r = await request('GET', `/api/educationportal/educator/review/${submissionId}`, token);
      const pass =
        r.status === 200 &&
        r.json?._id &&
        r.json?.student?.name &&
        !String(r.json.student.name).includes('undefined') &&
        r.json?.reviewStatus === 'in_review';
      results.push({
        test: '1 Fetch submission',
        pass,
        status: r.status,
        body: {
          student: r.json?.student,
          reviewStatus: r.json?.reviewStatus,
          status: r.json?.status,
          assignment: r.json?.assignment?.name,
        },
        error: pass ? undefined : r.json,
      });
    }

    // Test 2: Save progress
    {
      const r = await request(
        'POST',
        `/api/educationportal/educator/review/${submissionId}/progress`,
        token,
        {
          collaborativeFeedback: 'Good work on the analysis',
          privateNotes: 'Student shows strong understanding',
          marksGiven: 85,
        },
      );
      results.push({
        test: '2 Save progress',
        pass: r.status === 200 && !!r.json?.savedAt,
        status: r.status,
        body: r.json,
      });
    }

    // Test 3: Add comment
    {
      const r = await request(
        'POST',
        `/api/educationportal/educator/review/${submissionId}/comments`,
        token,
        {
          pageNumber: 1,
          comment: 'Great introduction, but needs more detail',
          isPrivate: false,
        },
      );
      commentId = r.json?.comment?._id;
      results.push({
        test: '3 Add comment',
        pass: r.status === 201 && !!commentId,
        status: r.status,
        body: r.json,
      });
    }

    // Test 4: Update comment
    {
      const r = await request(
        'PUT',
        `/api/educationportal/educator/review/${submissionId}/comments/${commentId}`,
        token,
        {
          comment: 'Updated: Great introduction with excellent detail',
          isPrivate: true,
        },
      );
      results.push({
        test: '4 Update comment',
        pass: r.status === 200 && r.json?.comment?.isPrivate === true,
        status: r.status,
        body: r.json,
      });
    }

    // Test 5: Delete comment
    {
      const r = await request(
        'DELETE',
        `/api/educationportal/educator/review/${submissionId}/comments/${commentId}`,
        token,
      );
      results.push({
        test: '5 Delete comment',
        pass: r.status === 200,
        status: r.status,
        body: r.json,
      });
    }

    // Test 6: Mark as graded
    {
      const r = await request(
        'POST',
        `/api/educationportal/educator/review/${submissionId}/submit`,
        token,
        {
          action: 'mark_as_graded',
          collaborativeFeedback: 'Excellent work overall!',
          privateNotes: 'Top student this semester',
          marksGiven: 92,
        },
      );
      const pass =
        r.status === 200 &&
        r.json?.submission?.grade === 'A' &&
        r.json?.submission?.marksGiven === 92 &&
        !String(r.json?.submission?.studentName || '').includes('undefined');
      results.push({
        test: '6 Mark as graded',
        pass,
        status: r.status,
        body: r.json,
      });
    }

    // Test 7: Request changes after graded (must clear grade/marks)
    {
      const r = await request(
        'POST',
        `/api/educationportal/educator/review/${submissionId}/submit`,
        token,
        {
          action: 'request_changes',
          collaborativeFeedback: 'Please add more references to support your arguments',
          privateNotes: 'Good potential, needs revision',
        },
      );
      const pass =
        r.status === 200 &&
        r.json?.submission?.status === 'changes_requested' &&
        r.json?.submission?.reviewStatus === 'changes_requested' &&
        (r.json?.submission?.grade === 'pending' || r.json?.submission?.grade == null) &&
        (r.json?.submission?.marksGiven === null || r.json?.submission?.marksGiven === undefined) &&
        !String(r.json?.submission?.studentName || '').includes('undefined');
      results.push({
        test: '7 Request changes clears grade',
        pass,
        status: r.status,
        body: r.json,
      });
    }

    console.log('\n========== TEST RESULTS ==========');
    let failed = 0;
    for (const r of results) {
      const mark = r.pass ? 'PASS' : 'FAIL';
      if (!r.pass) failed += 1;
      console.log(`[${mark}] ${r.test} (HTTP ${r.status})`);
      if (!r.pass) console.log('  detail:', JSON.stringify(r.body || r.error, null, 2));
    }
    console.log(`\n${results.length - failed}/${results.length} passed`);
    console.log(`submissionId=${submissionId}`);
    console.log(`reviewerId=${reviewerId}`);

    process.exit(failed ? 1 : 0);
  } catch (err) {
    console.error('Test harness failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
