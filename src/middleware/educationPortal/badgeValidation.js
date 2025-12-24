const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  next();
};

const validateCreateBadge = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Badge name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Badge name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Badge name can only contain letters, numbers, spaces, hyphens, and underscores'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  
  body('image_url')
    .trim()
    .notEmpty()
    .withMessage('Image URL is required')
    .isURL()
    .withMessage('Must be a valid URL'),
  
  body('category')
    .optional()
    .isIn(['capstone', 'lesson_completion', 'achievement', 'milestone'])
    .withMessage('Invalid category. Must be one of: capstone, lesson_completion, achievement, milestone'),
  
  body('points')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Points must be a number between 0 and 10000'),
  
  body('criteria')
    .optional()
    .isObject()
    .withMessage('Criteria must be an object'),
  
  handleValidationErrors,
];

const validateUpdateBadge = [
  body('badge_id')
    .notEmpty()
    .withMessage('Badge ID is required')
    .isMongoId()
    .withMessage('Invalid badge ID format'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Badge name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage('Badge name can only contain letters, numbers, spaces, hyphens, and underscores'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  
  body('image_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Must be a valid URL'),
  
  body('category')
    .optional()
    .isIn(['capstone', 'lesson_completion', 'achievement', 'milestone'])
    .withMessage('Invalid category'),
  
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  body('points')
    .optional()
    .isInt({ min: 0, max: 10000 })
    .withMessage('Points must be a number between 0 and 10000'),
  
  handleValidationErrors,
];

const validateAwardBadge = [
  body('student_id')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Invalid student ID format'),
  
  body('badge_id')
    .notEmpty()
    .withMessage('Badge ID is required')
    .isMongoId()
    .withMessage('Invalid badge ID format'),
  
  body('reason')
    .optional()
    .isIn(['capstone_completion', 'lesson_completion', 'manual_award', 'milestone'])
    .withMessage('Invalid reason'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  
  handleValidationErrors,
];

const validateRevokeBadge = [
  body('student_badge_id')
    .notEmpty()
    .withMessage('Student badge ID is required')
    .isMongoId()
    .withMessage('Invalid student badge ID format'),
  
  body('revoke_reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Revoke reason must not exceed 200 characters'),
  
  handleValidationErrors,
];

const validateBadgeQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('category')
    .optional()
    .isIn(['capstone', 'lesson_completion', 'achievement', 'milestone'])
    .withMessage('Invalid category'),
  
  query('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  
  handleValidationErrors,
];

const validateReason = [
  body('reason')
    .notEmpty()
    .withMessage('Reason is required')
    .isIn(['capstone_completion', 'lesson_completion', 'manual_award', 'milestone'])
    .withMessage('Invalid reason parameter'),
  
  handleValidationErrors,
];

const validateDeleteBadge = [
  body('badge_id')
    .notEmpty()
    .withMessage('Badge ID is required')
    .isMongoId()
    .withMessage('Invalid badge ID format'),
  
  handleValidationErrors,
];

module.exports = {
  validateCreateBadge,
  validateUpdateBadge,
  validateAwardBadge,
  validateRevokeBadge,
  validateBadgeQuery,
  validateReason,
  validateDeleteBadge,
};