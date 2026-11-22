const InactiveReason = {
  PAUSED: 'Paused',
  SEPARATED: 'Separated',
  SCHEDULED_SEPARATION: 'ScheduledSeparation',
};

const UserStatusOperations = {
  ACTIVATE: 'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
  SCHEDULE_DEACTIVATION: 'SCHEDULE_DEACTIVATION',
  PAUSE: 'PAUSE',
};

const LifecycleStatus = {
  PAUSE_TO_ACTIVE: 'PauseToActive',
  SEPARATED_TO_ACTIVE: 'SeparatedToActive',
  SCHEDULED_SEPARATION_TO_ACTIVE: 'ScheduledSeparationToActive',
};

const PRONOUN_OPTIONS = ['He/Him', 'She/Her', 'They/Them'];

/**
 * Normalizes a pronoun value from a request body.
 * Returns '' for missing/empty input, the value if it is one of
 * PRONOUN_OPTIONS, or null if it is not an allowed value.
 */
const normalizePronouns = (value) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return PRONOUN_OPTIONS.includes(trimmed) ? trimmed : null;
};

module.exports = {
  PRONOUN_OPTIONS,
  normalizePronouns,
  InactiveReason,
  UserStatusOperations,
  LifecycleStatus,
};
