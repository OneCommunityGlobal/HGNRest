// Temporary mock data for testing purposes
const activities = [
  { _id: '1', title: 'Test Event', description: 'A test event for rescheduling', date: '2025-02-23T12:00:00Z' }
];

// Get activity by ID
exports.getActivityById = async (req, res) => {
  try {
    const activity = activities.find((a) => a._id === req.params.activityId);  // Mock find by ID
    if (!activity) return res.status(404).json({ message: 'Activity not found' });
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Reschedule event (mock behavior)
exports.rescheduleActivity = async (req, res) => {
  try {
    const { newDate } = req.body;
    const activity = activities.find((a) => a._id === req.params.activityId);  // Mock find by ID
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    // Update the date for the activity
    activity.date = newDate;  // Update the mock data directly

    res.json({ message: 'Activity rescheduled successfully', activity });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
