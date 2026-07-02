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

module.exports = {
  InactiveReason,
  UserStatusOperations,
  LifecycleStatus,
};
