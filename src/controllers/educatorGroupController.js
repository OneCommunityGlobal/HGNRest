const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const UserProfile = require('../models/userProfile');

/**
 * Get all students (for educator selection UI)
 */
exports.getAllStudents = async (req, res) => {
  try {
    const students = await UserProfile.find({ role: 'student' })
      .select('_id firstName lastName')
      .sort({ firstName: 1 });

    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a new student group (educator-owned)
 */
exports.createGroup = async (req, res) => {
  try {
    const { description, studentIds = [] } = req.body;
    const educatorId = req.user;

    // Create group
    const group = await StudentGroup.create({
      educator_id: educatorId,
      description,
    });

    // Add members if provided
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const members = studentIds.map((studentId) => ({
        group_id: group._id,
        student_id: studentId,
      }));

      await StudentGroupMember.insertMany(members, { ordered: false }).catch(() => {});
    }

    // Populate educator so virtual `name` works
    const populatedGroup = await StudentGroup.findById(group._id).populate(
      'educator_id',
      'firstName lastName',
    );

    res.status(201).json({
      message: 'Group created successfully',
      group: populatedGroup,
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Get all groups for logged-in educator
 */
exports.getGroups = async (req, res) => {
  try {
    const educatorId = req.user;

    const groups = await StudentGroup.find({ educator_id: educatorId })
      .populate('educator_id', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get members of a specific group
 */
exports.getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const educatorId = req.user;

    // Ownership check
    const group = await StudentGroup.findOne({
      _id: groupId,
      educator_id: educatorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    const members = await StudentGroupMember.find({ group_id: groupId }).populate(
      'student_id',
      'firstName lastName',
    );

    res.status(200).json(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Add students to a group
 */
exports.addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { studentIds } = req.body;
    const educatorId = req.user;

    const group = await StudentGroup.findOne({
      _id: groupId,
      educator_id: educatorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    const members = studentIds.map((studentId) => ({
      group_id: groupId,
      student_id: studentId,
    }));

    await StudentGroupMember.insertMany(members, { ordered: false }).catch(() => {});
    res.status(201).json({ added: studentIds.length });
  } catch (error) {
    console.error('Error adding members:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Remove students from a group
 */
exports.removeMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { studentIds } = req.body;
    const educatorId = req.user;

    const group = await StudentGroup.findOne({
      _id: groupId,
      educator_id: educatorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    await StudentGroupMember.deleteMany({
      group_id: groupId,
      student_id: { $in: studentIds },
    });

    res.status(200).json({ removed: studentIds.length });
  } catch (error) {
    console.error('Error removing members:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Delete a group and its members
 */
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const educatorId = req.user;

    const group = await StudentGroup.findOneAndDelete({
      _id: groupId,
      educator_id: educatorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    await StudentGroupMember.deleteMany({ group_id: groupId });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Update group details (e.g., description)
 */
exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { description } = req.body;
    const educatorId = req.user;

    // Ensure educator owns this group
    const group = await StudentGroup.findOneAndUpdate(
      { _id: groupId, educator_id: educatorId },
      { description },
      { new: true },
    );

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    res.status(200).json(group);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(400).json({ error: error.message });
  }
};
