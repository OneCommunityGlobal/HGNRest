const { hasPermission } = require('./permissions');

/** Permission keys for job application form management (see Permissions.json). */
const JOB_FORM_PERMISSIONS = {
  MANAGE: 'manageJobForms',
  CREATE: 'createFormQuestions',
  EDIT: 'editFormQuestions',
  DELETE: 'deleteFormQuestions',
};

const hasAnyJobFormPermission = async (requestor, actions) => {
  const checks = await Promise.all(actions.map((action) => hasPermission(requestor, action)));
  return checks.some(Boolean);
};

/** Full form management (create/delete forms, view responses, templates). */
const canManageJobForms = async (requestor) =>
  hasPermission(requestor, JOB_FORM_PERMISSIONS.MANAGE);

/** Any job-form-related permission (read question sets/templates in management UI). */
const canAccessJobFormManagement = async (requestor) =>
  hasAnyJobFormPermission(requestor, Object.values(JOB_FORM_PERMISSIONS));

const canCreateFormQuestions = async (requestor) =>
  hasAnyJobFormPermission(requestor, [JOB_FORM_PERMISSIONS.MANAGE, JOB_FORM_PERMISSIONS.CREATE]);

const canEditFormQuestions = async (requestor) =>
  hasAnyJobFormPermission(requestor, [JOB_FORM_PERMISSIONS.MANAGE, JOB_FORM_PERMISSIONS.EDIT]);

const canDeleteFormQuestions = async (requestor) =>
  hasAnyJobFormPermission(requestor, [JOB_FORM_PERMISSIONS.MANAGE, JOB_FORM_PERMISSIONS.DELETE]);

module.exports = {
  JOB_FORM_PERMISSIONS,
  canManageJobForms,
  canAccessJobFormManagement,
  canCreateFormQuestions,
  canEditFormQuestions,
  canDeleteFormQuestions,
};
