// v1.1.0
const { createHash } = require('crypto');
const mongoose = require('mongoose');
const Profile = require('../models/bmdashboard/projectRiskProfile');
const Observation = require('../models/bmdashboard/projectRiskObservation');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const BuildingIssue = require('../models/bmdashboard/buildingIssue');
const { calculateRiskMetrics } = require('./projectRiskMetrics');

const DAY = 86400000;
// A new fixture namespace preserves existing legacy demo records without mapping them.
const DATASET = 'project-risk-demo-v2';
const demoId = (key) =>
  mongoose.Types.ObjectId(
    createHash('sha256').update(`${DATASET}:${key}`).digest('hex').slice(0, 24),
  );
const scenarios = [
  { name: 'Low risk', planned: 300, variance: -10, issues: 1 },
  { name: 'Medium risk', planned: 220, variance: 8, issues: 4 },
  { name: 'High risk', planned: 190, variance: 30, issues: 12 },
  { name: 'Completed under budget', planned: 220, variance: -5, issues: 0, completed: true },
  { name: 'Missing cost data', planned: 300, variance: null, issues: 2 },
];

async function seedProjectRisk(now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 240 * DAY);
  await Observation.init();
  await Promise.all(
    scenarios.map(async (scenario) => {
      const projectId = demoId(`project:${scenario.name}`);
      const profileId = demoId(`profile:${scenario.name}`);
      const name = `[Risk Demo] ${scenario.name}`;
      // These filters deliberately refuse to overwrite an ordinary record with a colliding ID.
      await BuildingProject.updateOne(
        { _id: projectId, name },
        { $set: { name, isActive: true } },
        { upsert: true, runValidators: true },
      );
      const issueIds = await Promise.all(
        Array.from({ length: scenario.issues }, async (_, index) => {
          const issueId = demoId(`issue:${scenario.name}:${index}`);
          const issueTitle = `${name} ${index + 1}`;
          await BuildingIssue.updateOne(
            { _id: issueId, projectId, issueTitle: [issueTitle] },
            {
              $set: {
                projectId,
                issueTitle: [issueTitle],
                issueText: ['Development risk demo fixture'],
                issueType: 'Equipment',
                issueDate: today,
                createdBy: demoId('creator'),
                status: 'open',
              },
            },
            { upsert: true, runValidators: true },
          );
          return issueId;
        }),
      );
      const profile = {
        projectId,
        startDate: start,
        endDate: new Date(start.getTime() + scenario.planned * DAY),
        initialCostEstimate: 100000,
        plannedTime: scenario.planned,
        status: scenario.completed ? 'completed' : 'active',
        completedAt: scenario.completed ? new Date(start.getTime() + 200 * DAY) : null,
        currentCostIncurred:
          scenario.variance === null
            ? null
            : 100000 *
              (1 + scenario.variance / 100) *
              (scenario.completed ? 1 : Math.min(240 / scenario.planned, 1)),
        issues: issueIds,
        demoDataset: DATASET,
      };
      await Profile.updateOne(
        { _id: profileId, demoDataset: DATASET },
        { $set: profile },
        { upsert: true, runValidators: true },
      );
      const operations = Array.from({ length: 181 }, (_, index) => {
        const daysAgo = 180 - index;
        const date = new Date(today.getTime() - daysAgo * DAY);
        const elapsed = 240 - daysAgo;
        const completed = scenario.completed && elapsed >= 200;
        const variance =
          scenario.variance === null
            ? null
            : scenario.variance - (scenario.completed ? 0 : daysAgo / 10);
        const metrics = calculateRiskMetrics(
          {
            ...profile,
            status: completed ? 'completed' : 'active',
            currentCostIncurred:
              variance === null
                ? null
                : 100000 *
                  (1 + variance / 100) *
                  (completed ? 1 : Math.min(elapsed / scenario.planned, 1)),
          },
          date,
        );
        return {
          updateOne: {
            filter: { profileId, date },
            update: {
              $set: {
                profileId,
                date,
                recordedAt: date,
                ...metrics,
                totalOpenIssues: Math.max(0, scenario.issues - Math.floor(daysAgo / 30)),
              },
            },
            upsert: true,
          },
        };
      });
      await Observation.bulkWrite(operations);
    }),
  );
  return { projects: scenarios.length, observations: scenarios.length * 181 };
}

module.exports = { seedProjectRisk };
