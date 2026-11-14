const mongoose = require('mongoose');

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const OBJECT_ID_LENGTH = 24;
const AVAILABILITY = {
  CURRENT_ONLY: 'CURRENT_ONLY',
  UNAVAILABLE: 'UNAVAILABLE',
};

function unavailableMetric(unit, reason) {
  return {
    value: null,
    unit,
    availability: AVAILABILITY.UNAVAILABLE,
    unavailableReason: reason,
    trend: null,
    comparisons: { wow: null, mom: null },
    alerts: null,
  };
}

function getProjectId(project) {
  if (!project || typeof project !== 'object' || Array.isArray(project)) {
    throw new TypeError('A single building project document is required');
  }

  const { _id } = project;
  if (_id instanceof mongoose.Types.ObjectId) return _id.toHexString();
  if (typeof _id === 'string' && _id.length === OBJECT_ID_LENGTH && OBJECT_ID_PATTERN.test(_id)) {
    return _id;
  }

  throw new TypeError('A building project document with a valid ObjectId is required');
}

/**
 * Builds a current snapshot from one already-loaded building project.
 * The caller must independently authorize the project before loading or using it.
 * This helper performs no database queries and does not accept a request query.
 */
function buildProjectKpiSnapshot(project) {
  const projectId = getProjectId(project);
  const members = Array.isArray(project.members)
    ? {
        value: project.members.length,
        unit: 'members',
        availability: AVAILABILITY.CURRENT_ONLY,
        unavailableReason: null,
        trend: null,
        comparisons: { wow: null, mom: null },
        alerts: null,
      }
    : unavailableMetric('members', 'Project member data is missing or is not an array.');

  return {
    projectId,
    metrics: {
      hours: unavailableMetric('hours', 'Reliable dated project hours are not available.'),
      materialsCost: unavailableMetric(
        'USD',
        'Purchase price provenance is not reliable for project materials.',
      ),
      equipmentCost: unavailableMetric(
        'USD',
        'Reliable project equipment costs are not available.',
      ),
      wastePercentage: unavailableMetric(
        '%',
        'A project waste percentage formula has not been approved.',
      ),
      members,
      rentals: unavailableMetric(null, 'Reliable rental status and due dates are not available.'),
      mostBoughtMaterial: unavailableMetric(
        null,
        'A consistent comparison across material units has not been established.',
      ),
      stockHealth: unavailableMetric(
        null,
        'Project inventory reorder thresholds are not available.',
      ),
    },
  };
}

module.exports = { buildProjectKpiSnapshot, AVAILABILITY };
