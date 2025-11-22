const signupDevAccount = async (req, res) => {
  try {
    const { productionEmail, productionPassword, firstName, lastName, devEmail } = req.body;

    if (!productionEmail || !productionPassword) {
      return res.status(400).json({
        success: false,
        message: 'Production credentials are required',
      });
    }

    // Log backend reached
    console.log('➡️ signupDevAccount() reached backend');

    // Mock Production identity validation
    const mockProdIdentity = {
      id: 'dummy-prod-id',
      email: productionEmail,
      firstName,
      lastName,
      status: 'active',
    };

    console.log('Production Identity:', mockProdIdentity);

    console.log('Creating Dev Account for:', devEmail);

    return res.status(201).json({
      success: true,
      message: 'Dev account created (mock)',
      data: {
        productionIdentity: mockProdIdentity,
        devEmail,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = signupDevAccount;
