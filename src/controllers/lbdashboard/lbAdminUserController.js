const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const LBUser = require('../../models/lbdashboard/LBuser');
const { registerUser, validateInput } = require('./lbdashboardController');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DUPLICATE_KEY_CODE = 11000;
const HTTP_CONFLICT = 409;
const BCRYPT_ROUNDS = 10;

// Whitelist of fields returned to the client; passwordHash and anything else stay out.
const PUBLIC_FIELDS = '_id firstName lastName email phone createdAt updatedAt';
const UPDATABLE_FIELDS = ['firstName', 'lastName', 'email', 'phone'];

const sanitizeUser = (doc) => ({
  _id: doc._id,
  firstName: doc.firstName,
  lastName: doc.lastName,
  email: doc.email,
  phone: doc.phone,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const parsePositiveInt = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return parsed >= 1 ? parsed : null;
};

const isValidId = (id) =>
  typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && /^[a-f\d]{24}$/i.test(id);

const serverError = (res, label, err) => {
  // eslint-disable-next-line no-console
  console.error(`${label}:`, err);
  return res.status(500).json({ error: 'Internal server error' });
};

exports.registerUser = registerUser;
exports.validateInput = validateInput;

exports.listUsers = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const page = parsePositiveInt(queryParams.page, DEFAULT_PAGE);
    const requestedLimit = parsePositiveInt(queryParams.limit, DEFAULT_LIMIT);

    if (page === null || requestedLimit === null) {
      return res.status(400).json({ error: 'page and limit must be positive integers' });
    }

    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const search = typeof queryParams.search === 'string' ? queryParams.search.trim() : '';

    const filter = {};
    if (search) {
      const pattern = { $regex: escapeRegex(search), $options: 'i' };
      filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }];
    }

    const [rawUsers, total] = await Promise.all([
      LBUser.find(filter)
        .select(PUBLIC_FIELDS)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LBUser.countDocuments(filter),
    ]);
    const users = rawUsers.map(sanitizeUser);

    return res.status(200).json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return serverError(res, 'List LB users error', err);
  }
};

exports.getUsers = exports.listUsers;

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid user id' });

    const rawUser = await LBUser.findById(id).select(PUBLIC_FIELDS).lean();
    if (!rawUser) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ user: sanitizeUser(rawUser) });
  } catch (err) {
    return serverError(res, 'Get LB user error', err);
  }
};

exports.getUser = exports.getUserById;

const extractUpdates = (body) => {
  const updates = {};
  UPDATABLE_FIELDS.forEach((field) => {
    if (typeof body[field] === 'string') updates[field] = body[field].trim();
  });
  return updates;
};

const validateUpdates = (updates, password) => {
  const hasPassword = password !== undefined;
  const validationErrors = validateInput({
    firstName: 'Placeholder',
    lastName: 'Placeholder',
    email: 'placeholder@example.com',
    phone: '1234567',
    ...updates,
    password: hasPassword ? password : 'placeholder1',
  });
  const errors = {};
  const changedFields = hasPassword ? [...Object.keys(updates), 'password'] : Object.keys(updates);
  changedFields.forEach((field) => {
    if (validationErrors[field]) errors[field] = validationErrors[field];
  });
  return errors;
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid user id' });

    const body = req.body || {};
    const updates = extractUpdates(body);
    const hasPassword = body.password !== undefined;

    if (Object.keys(updates).length === 0 && !hasPassword) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const errors = validateUpdates(updates, body.password);
    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      const taken = await LBUser.findOne({ email: updates.email, _id: { $ne: id } }).select('_id');
      if (taken) return res.status(HTTP_CONFLICT).json({ error: 'Email already registered' });
    }
    if (hasPassword) updates.passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    const rawUser = await LBUser.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .select(PUBLIC_FIELDS)
      .lean();
    if (!rawUser) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ message: 'User updated', user: sanitizeUser(rawUser) });
  } catch (err) {
    if (err?.code === DUPLICATE_KEY_CODE) {
      return res.status(HTTP_CONFLICT).json({ error: 'Email already registered' });
    }
    return serverError(res, 'Update LB user error', err);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid user id' });

    const user = await LBUser.findByIdAndDelete(id).select('_id');
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ message: 'User deleted', userId: user._id });
  } catch (err) {
    return serverError(res, 'Delete LB user error', err);
  }
};
