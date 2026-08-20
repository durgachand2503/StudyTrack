const { body, param, query, validationResult } = require('express-validator');

// Centralized validation error handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(err => err.msg);
    return res.status(400).json({
      success: false,
      message: messages[0],
      errors: messages
    });
  }
  next();
};

// Auth validations
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required.')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters.'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and a number.'),
  body('confirmPassword')
    .notEmpty().withMessage('Confirm password is required.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
  validate
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email.')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required.'),
  validate
];

// Task validations
const taskValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Task title is required.')
    .isLength({ max: 200 }).withMessage('Title must be under 200 characters.'),
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required.'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level.'),
  body('status')
    .optional()
    .isIn(['pending', 'in-progress', 'completed', 'overdue']).withMessage('Invalid status.'),
  body('dueDate')
    .optional()
    .isISO8601().withMessage('Invalid date format.'),
  body('estimatedDuration')
    .optional()
    .isInt({ min: 1 }).withMessage('Estimated duration must be a positive number.'),
  validate
];

// Session validations
const sessionValidation = [
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required.'),
  body('duration')
    .isInt({ min: 1 }).withMessage('Duration must be a positive number.'),
  body('actualDuration')
    .isInt({ min: 1 }).withMessage('Actual duration must be a positive number.'),
  body('startTime')
    .notEmpty().withMessage('Start time is required.')
    .isISO8601().withMessage('Invalid start time format.'),
  body('endTime')
    .notEmpty().withMessage('End time is required.')
    .isISO8601().withMessage('Invalid end time format.'),
  validate
];

// Group validations
const groupValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Group name is required.')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be under 500 characters.'),
  body('category')
    .optional()
    .trim(),
  body('privacy')
    .optional()
    .isIn(['public', 'private']).withMessage('Privacy must be public or private.'),
  validate
];

// Channel validations
const channelValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Channel name is required.')
    .isLength({ max: 100 }).withMessage('Name must be under 100 characters.'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Description must be under 500 characters.'),
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required.'),
  validate
];

// Assignment validations
const assignmentValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Assignment title is required.')
    .isLength({ max: 200 }).withMessage('Title must be under 200 characters.'),
  body('description')
    .optional()
    .trim(),
  body('instructions')
    .optional()
    .trim(),
  body('channelId')
    .notEmpty().withMessage('Channel is required.')
    .isMongoId().withMessage('Invalid channel ID.'),
  body('dueDate')
    .notEmpty().withMessage('Due date is required.')
    .isISO8601().withMessage('Invalid date format.'),
  body('maxPoints')
    .optional()
    .isInt({ min: 0, max: 1000 }).withMessage('Max points must be 0–1000.'),
  validate
];

// Message validations
const messageValidation = [
  body('content')
    .trim()
    .notEmpty().withMessage('Message content is required.')
    .isLength({ max: 2000 }).withMessage('Message must be under 2000 characters.'),
  validate
];

// ID parameter validation
const mongoIdParam = (paramName = 'id') => [
  param(paramName)
    .isMongoId().withMessage(`Invalid ${paramName}.`),
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  taskValidation,
  sessionValidation,
  groupValidation,
  channelValidation,
  assignmentValidation,
  messageValidation,
  mongoIdParam
};
