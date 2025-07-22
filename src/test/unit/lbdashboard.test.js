const { validateInput } = require('../../controllers/lbdashboard/lbdashboardController');

describe('validateInput', () => {
  it('should return errors for invalid fields', () => {
    const result = validateInput({
      firstName: '',
      lastName: '1',
      email: 'abc@',
      phone: 'abc123',
      password: '123',
    });

    expect(result.firstName).toMatch(/at least 2 letters/);
    expect(result.lastName).toMatch(/at least 2 letters/);
    expect(result.email).toMatch(/Invalid email/);
   expect(result.phone).toMatch(/7-15 digits/); 
    expect(result.password).toMatch(/Password must be at least 8 characters/);
  });

  it('should return empty object for valid data', () => {
    const result = validateInput({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '+12345678901',
      password: 'Pass1234!',
    });

    expect(result).toEqual({});
  });
});
