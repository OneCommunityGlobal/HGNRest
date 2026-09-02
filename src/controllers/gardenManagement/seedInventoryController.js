const mongoose = require('mongoose');
const SeedInventory = require('../../models/gardenManagement/seedInventory');

const sendServerError = (res, error) => {
  console.error(error);

  return res.status(500).json({
    message: 'Internal server error',
  });
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Validate a date value.
 */
const parseDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return {
      valid: false,
      message: `${fieldName} is required`,
    };
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime())
    ? {
        valid: false,
        message: `Invalid ${fieldName}`,
      }
    : {
        valid: true,
        value: parsedDate,
      };
};

/**
 * Validate quantity.
 */
const validateQuantity = (quantity) =>
  quantity !== undefined &&
  quantity !== null &&
  quantity !== '' &&
  !Number.isNaN(Number(quantity)) &&
  Number(quantity) >= 0;

/**
 * Validate viability percentage.
 */
const validateViability = (viable) =>
  viable !== undefined &&
  viable !== null &&
  viable !== '' &&
  !Number.isNaN(Number(viable)) &&
  Number(viable) >= 0 &&
  Number(viable) <= 100;

/**
 * Validate numeric query parameter.
 */
const validateRangeValue = (value, min, max, message) => {
  if (
    Number.isNaN(Number(value)) ||
    Number(value) < min ||
    (max !== undefined && Number(value) > max)
  ) {
    return {
      valid: false,
      message,
    };
  }

  return {
    valid: true,
    value: Number(value),
  };
};

/**
 * Add quantity filters to query.
 */
const addQuantityFilters = (query, minQuantity, maxQuantity) => {
  if (minQuantity === undefined && maxQuantity === undefined) {
    return null;
  }

  const quantityQuery = {};

  if (minQuantity !== undefined) {
    const result = validateRangeValue(minQuantity, 0, undefined, 'Invalid minimum quantity');

    if (!result.valid) {
      return result;
    }

    quantityQuery.$gte = result.value;
  }

  if (maxQuantity !== undefined) {
    const result = validateRangeValue(maxQuantity, 0, undefined, 'Invalid maximum quantity');

    if (!result.valid) {
      return result;
    }

    quantityQuery.$lte = result.value;
  }

  if (
    quantityQuery.$gte !== undefined &&
    quantityQuery.$lte !== undefined &&
    quantityQuery.$gte > quantityQuery.$lte
  ) {
    return {
      valid: false,
      message: 'Minimum quantity cannot be greater than maximum quantity',
    };
  }

  query.quantity = quantityQuery;

  return {
    valid: true,
  };
};

/**
 * Add viability filters to query.
 */
const addViabilityFilters = (query, minViable, maxViable) => {
  if (minViable === undefined && maxViable === undefined) {
    return null;
  }

  const viableQuery = {};

  if (minViable !== undefined) {
    const result = validateRangeValue(minViable, 0, 100, 'Invalid minimum viability');

    if (!result.valid) {
      return result;
    }

    viableQuery.$gte = result.value;
  }

  if (maxViable !== undefined) {
    const result = validateRangeValue(maxViable, 0, 100, 'Invalid maximum viability');

    if (!result.valid) {
      return result;
    }

    viableQuery.$lte = result.value;
  }

  if (
    viableQuery.$gte !== undefined &&
    viableQuery.$lte !== undefined &&
    viableQuery.$gte > viableQuery.$lte
  ) {
    return {
      valid: false,
      message: 'Minimum viability cannot be greater than maximum viability',
    };
  }

  query.viable = viableQuery;

  return {
    valid: true,
  };
};

/**
 * Build seed inventory search query.
 */
const buildInventoryQuery = (queryParams) => {
  const { search = '', minQuantity, maxQuantity, minViable, maxViable } = queryParams;

  const query = {};

  if (typeof search === 'string' && search.trim()) {
    query.name = {
      $regex: escapeRegex(search.trim()),
      $options: 'i',
    };
  }

  const quantityResult = addQuantityFilters(query, minQuantity, maxQuantity);

  if (quantityResult && !quantityResult.valid) {
    return quantityResult;
  }

  const viabilityResult = addViabilityFilters(query, minViable, maxViable);

  if (viabilityResult && !viabilityResult.valid) {
    return viabilityResult;
  }

  return {
    valid: true,
    query,
  };
};

/**
 * GET all seed inventory
 *
 * GET /api/kitchenandinventory/gardenmanagement/seeds
 */
const getSeedInventory = async (req, res) => {
  try {
    const result = buildInventoryQuery(req.query);

    if (!result.valid) {
      return res.status(400).json({
        message: result.message,
      });
    }

    const seeds = await SeedInventory.find(result.query).sort({ collectedDate: -1 }).lean();

    return res.status(200).json(seeds);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * GET seed inventory by ID
 *
 * GET /api/kitchenandinventory/gardenmanagement/seeds/:id
 */
const getSeedInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed inventory ID',
      });
    }

    const seed = await SeedInventory.findById(id).lean();

    if (!seed) {
      return res.status(404).json({
        message: 'Seed inventory item not found',
      });
    }

    return res.status(200).json(seed);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * Validate create seed inventory request.
 */
const validateCreateSeed = (data) => {
  const { name, collectedDate, quantity, viable } = data;

  if (typeof name !== 'string' || !name.trim()) {
    return {
      valid: false,
      message: 'Seed name is required',
    };
  }

  const parsedDate = parseDate(collectedDate, 'collected date');

  if (!parsedDate.valid) {
    return parsedDate;
  }

  if (!validateQuantity(quantity)) {
    return {
      valid: false,
      message: 'Quantity must be a non-negative number',
    };
  }

  if (!validateViability(viable)) {
    return {
      valid: false,
      message: 'Viability must be a number between 0 and 100',
    };
  }

  return {
    valid: true,
    value: {
      name: name.trim(),
      collectedDate: parsedDate.value,
      quantity: Number(quantity),
      viable: Number(viable),
    },
  };
};

/**
 * CREATE seed inventory
 *
 * POST /api/kitchenandinventory/gardenmanagement/seeds
 */
const createSeedInventory = async (req, res) => {
  try {
    const validation = validateCreateSeed(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        message: validation.message,
      });
    }

    const seed = await SeedInventory.create(validation.value);

    return res.status(201).json(seed);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * Validate and prepare seed inventory updates.
 */
const prepareSeedUpdates = (body) => {
  const allowedFields = ['name', 'collectedDate', 'quantity', 'viable'];

  const updates = {};

  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  });

  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || !updates.name.trim()) {
      return {
        valid: false,
        message: 'Seed name cannot be empty',
      };
    }

    updates.name = updates.name.trim();
  }

  if (updates.collectedDate !== undefined) {
    const parsedDate = parseDate(updates.collectedDate, 'collected date');

    if (!parsedDate.valid) {
      return parsedDate;
    }

    updates.collectedDate = parsedDate.value;
  }

  if (updates.quantity !== undefined) {
    if (!validateQuantity(updates.quantity)) {
      return {
        valid: false,
        message: 'Quantity must be a non-negative number',
      };
    }

    updates.quantity = Number(updates.quantity);
  }

  if (updates.viable !== undefined) {
    if (!validateViability(updates.viable)) {
      return {
        valid: false,
        message: 'Viability must be a number between 0 and 100',
      };
    }

    updates.viable = Number(updates.viable);
  }

  if (Object.keys(updates).length === 0) {
    return {
      valid: false,
      message: 'No valid fields provided for update',
    };
  }

  return {
    valid: true,
    updates,
  };
};

/**
 * UPDATE seed inventory
 *
 * PUT /api/kitchenandinventory/gardenmanagement/seeds/:id
 */
const updateSeedInventory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed inventory ID',
      });
    }

    const validation = prepareSeedUpdates(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        message: validation.message,
      });
    }

    const seed = await SeedInventory.findByIdAndUpdate(id, validation.updates, {
      new: true,
      runValidators: true,
    });

    if (!seed) {
      return res.status(404).json({
        message: 'Seed inventory item not found',
      });
    }

    return res.status(200).json(seed);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * DELETE seed inventory
 *
 * DELETE /api/kitchenandinventory/gardenmanagement/seeds/:id
 */
const deleteSeedInventory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed inventory ID',
      });
    }

    const seed = await SeedInventory.findByIdAndDelete(id);

    if (!seed) {
      return res.status(404).json({
        message: 'Seed inventory item not found',
      });
    }

    return res.status(200).json({
      message: 'Seed inventory item deleted successfully',
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * UPDATE seed quantity
 *
 * PATCH /api/kitchenandinventory/gardenmanagement/seeds/:id/quantity
 */
const updateSeedQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid seed inventory ID',
      });
    }

    if (!validateQuantity(quantity)) {
      return res.status(400).json({
        message: 'Quantity must be a non-negative number',
      });
    }

    const seed = await SeedInventory.findByIdAndUpdate(
      id,
      {
        quantity: Number(quantity),
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!seed) {
      return res.status(404).json({
        message: 'Seed inventory item not found',
      });
    }

    return res.status(200).json(seed);
  } catch (error) {
    return sendServerError(res, error);
  }
};

module.exports = {
  getSeedInventory,
  getSeedInventoryById,
  createSeedInventory,
  updateSeedInventory,
  deleteSeedInventory,
  updateSeedQuantity,
};
