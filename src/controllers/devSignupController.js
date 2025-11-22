const UserProfile = require('../models/userProfile');
const devSignupLog = require('../models/devSignupLog');

const devSignup = async (req, res) => {
  const requestIP = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const {
      productionEmail,
      productionPassword,
      firstName,
      lastName,
      email: devEmail,
      devPassword,
    } = req.body;

    const strongPassword = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

    if (!strongPassword.test(devPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must contain uppercase, lowercase, number, and be at least 8 characters.',
      });
    }

    // ------------------------------
    // Validation: Production creds required
    // ------------------------------
    if (!productionEmail || !productionPassword) {
      await devSignupLog.create({
        productionEmail,
        devEmail,
        status: 'error',
        ipAddress: requestIP,
        reason: 'Missing production credentials',
      });

      return res.status(400).json({
        success: false,
        message: 'Production credentials are required',
      });
    }

    // ------------------------------
    // Validation: Dev first/last name
    // ------------------------------
    if (!firstName || !lastName) {
      await devSignupLog.create({
        productionEmail,
        devEmail,
        status: 'error',
        ipAddress: requestIP,
        reason: 'Missing first or last name',
      });

      return res.status(400).json({
        success: false,
        message: 'First name and last name are required',
      });
    }

    // ------------------------------
    // Validation: Dev email required
    // ------------------------------
    if (!devEmail) {
      await devSignupLog.create({
        productionEmail,
        devEmail,
        status: 'error',
        ipAddress: requestIP,
        reason: 'Missing dev email',
      });

      return res.status(400).json({
        success: false,
        message: 'Dev account email is required',
      });
    }

    // ------------------------------
    // Validation: Dev email duplicate
    // ------------------------------
    const existing = await UserProfile.findOne({ email: devEmail });
    if (existing) {
      await devSignupLog.create({
        productionEmail,
        devEmail,
        status: 'error',
        ipAddress: requestIP,
        reason: 'Dev email already exists',
      });

      return res.status(409).json({
        success: false,
        message: 'A Dev user with this email already exists.',
      });
    }

    // ------------------------------
    // Mock Production Identity Validation
    // ------------------------------
    const mockProductionIdentity = {
      id: 'dummy-prod-id',
      email: productionEmail,
      firstName,
      lastName,
      status: 'active',
    };

    // ------------------------------
    // Create the Dev user
    // ------------------------------
    const newUser = await UserProfile.create({
      firstName,
      lastName,
      email: devEmail,
      password: devPassword,
      role: 'Volunteer',
      isProductionLinked: true,
      productionIdentity: {
        prodEmail: productionEmail,
        prodUserId: mockProductionIdentity.id,
      },
    });

    // ------------------------------
    // SUCCESS LOG
    // ------------------------------
    await devSignupLog.create({
      productionEmail,
      devEmail,
      status: 'success',
      ipAddress: requestIP,
      reason: null,
      linkedUserId: newUser._id,
    });

    // ------------------------------
    // Final Response
    // ------------------------------
    return res.status(201).json({
      success: true,
      message: 'Dev account created successfully',
      data: {
        productionIdentity: mockProductionIdentity,
        devEmail,
      },
    });
  } catch (err) {
    console.error('Signup Error:', err);

    // ------------------------------
    // FAILURE LOG
    // ------------------------------
    await devSignupLog.create({
      productionEmail: req.body.productionEmail,
      devEmail: req.body.email,
      status: 'error',
      ipAddress: requestIP,
      reason: err.message,
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = { devSignup };
