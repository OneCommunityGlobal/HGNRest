async function validateProductionIdentity(email, password) {
  // TODO: connect to real Production API or IdP later
  // For now, mock successful response for testing

  if (!email || !password) {
    return {
      success: false,
      error: 'Missing Production credentials',
    };
  }

  // MOCK active account for development testing
  return {
    success: true,
    user: {
      id: 'dummy-prod-user-id',
      email,
      firstName: 'ProdFirstName',
      lastName: 'ProdLastName',
      status: 'active',
    },
  };
}

module.exports = { validateProductionIdentity };
