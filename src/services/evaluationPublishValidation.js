const mongoose = require('mongoose');
const moment = require('moment');
const { cleanHtml } = require('../utilities/htmlContentSanitizer');

const invalid = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, name, required = false) => {
  if ((value === null || value === undefined) && !required) return null;
  if (typeof value !== 'string' || (required && !value.trim()))
    invalid(`${name} must be a nonempty string`);
  return value.trim() || null;
};
const number = (value, name, maximum = Infinity, integer = false) => {
  if (value === null || value === undefined) return null;
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    invalid(
      `${name} must be a finite nonnegative ${integer ? 'integer' : 'number'}${maximum === Infinity ? '' : ` <= ${maximum}`}`,
    );
  }
  return value;
};
const date = (value, name) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !moment(value, moment.ISO_8601, true).isValid()) {
    invalid(`${name} must be an ISO date`);
  }
  return new Date(value);
};
const statuses = ['pending', 'submitted', 'graded', 'completed', 'missing', 'on_time', 'late'];

function assessment(input, name) {
  const result = {
    weightage: number(input.weightage, `${name}.weightage`),
    marks: number(input.marks, `${name}.marks`),
    maxMarks: number(input.maxMarks, `${name}.maxMarks`),
    percentage: number(input.percentage, `${name}.percentage`, 100),
    feedback: text(input.feedback, `${name}.feedback`),
  };
  if (result.marks !== null && result.maxMarks !== null && result.marks > result.maxMarks) {
    invalid(`${name}.marks cannot exceed maxMarks`);
  }
  return result;
}

function task(input) {
  if (!object(input)) invalid('Each task must be an object');
  const result = {
    ...assessment(input, 'task'),
    taskName: text(input.taskName, 'taskName', true),
    type: text(input.type, 'task.type'),
    status: text(input.status, 'task.status') || 'pending',
    dueDate: date(input.dueDate, 'dueDate'),
    submissionDate: date(input.submissionDate, 'submissionDate'),
  };
  if (!statuses.includes(result.status)) invalid('Invalid task status');
  return result;
}

function category(input) {
  if (!object(input) || !Array.isArray(input.tasks))
    invalid('Each evaluation must include category and tasks array');
  const result = {
    ...assessment(input, 'category'),
    category: text(input.category, 'category', true),
    totalItems: number(input.totalItems, 'totalItems', Infinity, true),
    completedItems: number(input.completedItems, 'completedItems', Infinity, true),
    performanceLevel: text(input.performanceLevel, 'performanceLevel'),
    tasks: input.tasks.map(task),
  };
  if (
    result.totalItems !== null &&
    result.completedItems !== null &&
    result.completedItems > result.totalItems
  ) {
    invalid('completedItems cannot exceed totalItems');
  }
  const names = result.tasks.map((item) => item.taskName.toLowerCase());
  if (new Set(names).size !== names.length) invalid('Task names must be unique within a category');
  return result;
}

function generalFeedback(input) {
  if (!object(input)) invalid('teacherFeedback must be an object');
  const allowed = ['overall', 'strengths', 'improvements', 'teacherTitle'];
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    invalid('Unsupported teacherFeedback field');
  const list = (value, name) => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) invalid(`${name} must be an array`);
    return value.map((item) => text(item, name, true));
  };
  return {
    overall: text(input.overall, 'teacherFeedback.overall'),
    teacherTitle: text(input.teacherTitle, 'teacherFeedback.teacherTitle'),
    strengths: list(input.strengths, 'strengths'),
    improvements: list(input.improvements, 'improvements'),
  };
}

// Validate and normalize the entire request before starting any database writes.
module.exports = ({ studentId, teacherId, evaluations, message, teacherFeedback }) => {
  const id = (value, name) => {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value))
      invalid(`Invalid ${name} ID provided.`);
    return new mongoose.Types.ObjectId(value);
  };
  const studentObjectId = id(studentId, 'student');
  const teacherObjectId = id(teacherId, 'teacher');
  if (!Array.isArray(evaluations) || !evaluations.length)
    invalid('evaluations must be a non-empty array');
  const normalized = evaluations.map(category);
  const names = normalized.map((item) => item.category.toLowerCase());
  if (new Set(names).size !== names.length) invalid('Category names must be unique');
  const sanitizedMessage = cleanHtml(
    text(
      message === undefined ? 'New evaluation results are available.' : message,
      'message',
      true,
    ),
  );
  if (!sanitizedMessage.trim()) invalid('message must contain permitted content');
  return {
    studentObjectId,
    teacherObjectId,
    evaluations: normalized,
    message: sanitizedMessage,
    teacherFeedback: teacherFeedback === undefined ? undefined : generalFeedback(teacherFeedback),
  };
};
