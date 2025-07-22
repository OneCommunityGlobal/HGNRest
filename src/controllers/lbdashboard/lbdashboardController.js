const bcrypt = require('bcrypt');
const LBUser = require('../../models/lbdashboard/LBUser');

const validateInput = (data) => {
  const errors = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*]{8,}$/;

  if (!data.firstName || data.firstName.length < 2 || /[^a-zA-Z]/.test(data.firstName)) {
    errors.firstName = 'First name must be at least 2 letters and contain only letters';
  }

  if (!data.lastName || data.lastName.length < 2 || /[^a-zA-Z]/.test(data.lastName)) {
    errors.lastName = 'Last name must be at least 2 letters and contain only letters';
  }

  if (!data.email || !emailRegex.test(data.email)) {
    errors.email = 'Invalid email format';
  }

  const digitOnly = data.phone?.replace(/\D/g, '');
  if (!data.phone || digitOnly.length < 7 || digitOnly.length > 15) {
    errors.phone = 'Phone must contain 7-15 digits';
  }

  if (!data.password || !passwordRegex.test(data.password)) {
    errors.password = 'Password must be at least 8 characters and include a number';
  }

  return errors;
};

exports.registerUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    const errors = validateInput(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await LBUser.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new LBUser({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      passwordHash,
    });

    await user.save();

    res.status(201).json({
      message: 'Registration successful',
      userId: user._id
    });

  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.validateInput = validateInput;
