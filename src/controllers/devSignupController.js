const UserProfile = require('../models/userProfile');
const { validateProductionIdentity } = require('../services/productionAuthService');

exports.devSignup = async (req, res) => {
  try {
    const { productionEmail, productionPassword, firstName, lastName, email, devPassword } =
      req.body;

    // Validate required input
    if (
      !productionEmail ||
      !productionPassword ||
      !firstName ||
      !lastName ||
      !email ||
      !devPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields. Required: productionEmail, productionPassword, firstName, lastName, email, devPassword',
      });
    }

    // Validate Production identity
    const result = await validateProductionIdentity(productionEmail, productionPassword);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.error || 'Production identity validation failed',
      });
    }

    const prodUser = result.user;

    if (prodUser.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your Production account is inactive and cannot create a Dev account.',
      });
    }

    // Ensure Dev email doesn't already exist
    const existing = await UserProfile.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A Dev user with this email already exists.',
      });
    }

    // Create Dev user (Dev data comes from Dev request)
    const newUser = new UserProfile({
      firstName,
      lastName,
      email,
      password: devPassword,
      role: 'Volunteer',
      isProductionLinked: true,
      isActive: true,

      // Store production metadata ONLY
      productionIdentity: {
        email: productionEmail,
        id: prodUser.id,
      },
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: 'Dev account created and linked to Production identity',
      userId: newUser._id,
    });
  } catch (err) {
    console.error('devSignup error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
