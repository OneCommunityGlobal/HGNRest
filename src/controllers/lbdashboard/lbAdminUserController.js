const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const LBUser = require('../../models/lbdashboard/LBuser');
const { registerUser, validateInput } = require('./lbdashboardController');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DUPLICATE_KEY_CODE = 11000;
const BCRYPT_ROUNDS = 10;

// Whitelist of fields returned to the client; passwordHash and anything else stay out.
const PUBLIC_FIELDS = '_id firstName lastName email phone createdAt updatedAt';
const UPDATABLE_FIELDS = ['firstName', 'lastName', 'email', 'phone'];

const sanitizeUser = (doc) => {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    _id: plain._id,
    firstName: plain.firstName,
    lastName: plain.lastName,
    email: plain.email,
    phone: plain.phone,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parsePositiveInt = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value))) return null;
  const parsed = Number(value);
  return parsed >= 1 ? parsed : null;
};

const isValidId = (id) =>
  Boolean(id) &&
  mongoose.Types.ObjectId.isValid(id) &&
  String(new mongoose.Types.ObjectId(id)) === String(id);

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

    let findQuery = LBUser.find(filter);
    if (findQuery && typeof findQuery.select === 'function') {
      findQuery = findQuery.select(PUBLIC_FIELDS);
    }
    if (findQuery && typeof findQuery.sort === 'function') {
      findQuery = findQuery.sort({ createdAt: -1 });
    }
    if (findQuery && typeof findQuery.skip === 'function') {
      findQuery = findQuery.skip((page - 1) * limit);
    }
    if (findQuery && typeof findQuery.limit === 'function') {
      findQuery = findQuery.limit(limit);
    }
    if (findQuery && typeof findQuery.lean === 'function') {
      findQuery = findQuery.lean();
    }

    const [rawUsers, total] = await Promise.all([findQuery, LBUser.countDocuments(filter)]);
    const users = Array.isArray(rawUsers) ? rawUsers.map(sanitizeUser) : [];

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

    let query = LBUser.findById(id);
    if (query && typeof query.select === 'function') query = query.select(PUBLIC_FIELDS);
    if (query && typeof query.lean === 'function') query = query.lean();

    const rawUser = await query;
    if (!rawUser) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ user: sanitizeUser(rawUser) });
  } catch (err) {
    return serverError(res, 'Get LB user error', err);
  }
};

exports.getUser = exports.getUserById;

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid user id' });

    const body = req.body || {};
    const updates = {};
    UPDATABLE_FIELDS.forEach((field) => {
      if (typeof body[field] === 'string') updates[field] = body[field].trim();
    });
    const hasPassword = body.password !== undefined;

    if (Object.keys(updates).length === 0 && !hasPassword) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    // Reuse the registration rules, but only report errors for the fields being changed.
    const validationErrors = validateInput({
      firstName: 'Placeholder',
      lastName: 'Placeholder',
      email: 'placeholder@example.com',
      phone: '1234567',
      ...updates,
      password: hasPassword ? body.password : 'placeholder1',
    });
    const errors = {};
    [...Object.keys(updates), ...(hasPassword ? ['password'] : [])].forEach((field) => {
      if (validationErrors[field]) errors[field] = validationErrors[field];
    });
    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    if (updates.email) {
      updates.email = updates.email.toLowerCase();
      let dupQuery = LBUser.findOne({ email: updates.email, _id: { $ne: id } });
      if (dupQuery && typeof dupQuery.select === 'function') dupQuery = dupQuery.select('_id');
      const taken = await dupQuery;
      if (taken) return res.status(409).json({ error: 'Email already registered' });
    }
    if (hasPassword) updates.passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);

    let updateQuery = LBUser.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (updateQuery && typeof updateQuery.select === 'function') {
      updateQuery = updateQuery.select(PUBLIC_FIELDS);
    }
    if (updateQuery && typeof updateQuery.lean === 'function') {
      updateQuery = updateQuery.lean();
    }

    const rawUser = await updateQuery;
    if (!rawUser) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ message: 'User updated', user: sanitizeUser(rawUser) });
  } catch (err) {
    if (err?.code === DUPLICATE_KEY_CODE) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    return serverError(res, 'Update LB user error', err);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid user id' });

    let deleteQuery = LBUser.findByIdAndDelete(id);
    if (deleteQuery && typeof deleteQuery.select === 'function') {
      deleteQuery = deleteQuery.select('_id');
    }

    const user = await deleteQuery;
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.status(200).json({ message: 'User deleted', userId: user._id });
  } catch (err) {
    return serverError(res, 'Delete LB user error', err);
  }
};
