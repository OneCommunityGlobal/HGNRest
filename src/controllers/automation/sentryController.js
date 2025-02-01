const sentryService = require('../../services/userManagementAutomation/sentryService');

// Controller function to invite a user
async function inviteUser(req, res) {
  const { email, role } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const { requestor } = req.body;
  if (
    requestor.requestorId !== userId &&
    (requestor.role !== 'Administrator' || requestor.role !== 'Owner')
  ) {
    res.status(403).send({ error: 'Unauthorized request' });
    return;
  }
  try {
    const invitation = await sentryService.inviteUser(email, role);  // Call the service to invite the user
    res.status(201).json({ message: 'Invitation sent', data: invitation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Controller function to remove a user by email
async function removeUser(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const { requestor } = req.body;
  if (
    requestor.requestorId !== userId &&
    (requestor.role !== 'Administrator' || requestor.role !== 'Owner')
  ) {
    res.status(403).send({ error: 'Unauthorized request' });
    return;
  }

  try {
    // Get all members and find the user to remove based on the email
    const members = await sentryService.getMembers();
    const userToRemove = members.find(member => member.email === email);

    if (userToRemove) {
      const message = await sentryService.removeUser(userToRemove.id);  // Call the service to remove the user
      res.status(200).json({ message });
    } else {
      res.status(404).json({ error: `User with email ${email} not found.` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  inviteUser,
  removeUser,
};
