/* eslint-disable max-classes-per-file */
/**
 * By throwing an instance of this class, the global error handler middleware will return the error message and status code.
 */
class CustomError extends Error {
  statusCode;

  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
  }
}

class ValidationError extends CustomError {
  constructor(message) {
    super(message, 400);
  }
}

class AuthenticationError extends CustomError {
  constructor(message) {
    super(message, 401);
  }
}

class AuthorizationError extends CustomError {
  constructor(message) {
    super(message, 403);
  }
}

class RuntimeError extends CustomError {
  constructor(message) {
    super(message, 500);
  }
}

// Define other error classes here...

module.exports = {
  CustomError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RuntimeError,
  // Export other error classes here...
};
