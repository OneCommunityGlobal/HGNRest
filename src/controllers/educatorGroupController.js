const mongoose = require('mongoose');

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create a new student group
 */
exports.createGroup = async (req, res) => {
  try {
    const currentUser = req.body.requestor;

    if (!currentUser || !currentUser.requestorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (currentUser.role !== 'Administrator') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, description, studentIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const group = await StudentGroup.create({
      educator_id: currentUser.requestorId,
      name,
      description,
    });

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const members = studentIds.map((studentId) => ({
        group_id: group._id,
        student_id: studentId,
      }));
      await StudentGroupMember.insertMany(members, { ordered: false });
    }

    res.status(201).json(group);
  } catch (err) {
    console.error('CREATE GROUP ERROR:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Get all groups for logged-in educator
 */
exports.getGroups = async (req, res) => {
  try {
    const currentUser = req.body.requestor;
    if (!currentUser || !currentUser.requestorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groups = await StudentGroup.find({
      educator_id: currentUser.requestorId,
    }).sort({ createdAt: -1 });

    res.status(200).json(groups);
  } catch (err) {
    console.error('GET GROUPS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get members of a group
 */
exports.getGroupMembers = async (req, res) => {
  try {
    const currentUser = req.body.requestor;
    const { groupId } = req.params;

    if (!currentUser || !currentUser.requestorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const group = await StudentGroup.findOne({
      _id: groupId,
      educator_id: currentUser.requestorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    const members = await StudentGroupMember.find({
      group_id: groupId,
    }).populate('student_id', 'firstName lastName');

    res.status(200).json(members);
  } catch (err) {
    console.error('GET GROUP MEMBERS ERROR:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Add students to a group
 */
exports.addMembers = async (req, res) => {
  try {
    const currentUser = req.body.requestor;
    const { groupId } = req.params;
    const { studentIds = [] } = req.body;

    if (!currentUser || !currentUser.requestorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const group = await StudentGroup.findOne({
      _id: groupId,
      educator_id: currentUser.requestorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    const members = studentIds.map((studentId) => ({
      group_id: groupId,
      student_id: studentId,
    }));

    await StudentGroupMember.insertMany(members, { ordered: false });

    res.status(201).json({ added: members.length });
  } catch (err) {
    console.error('ADD MEMBERS ERROR:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Remove students from a group
 */
exports.removeMembers = async (req, res) => {
  try {
    const currentUser = req.body.requestor;
    const { groupId } = req.params;
    const { studentIds = [] } = req.body;

    if (!currentUser || !currentUser.requestorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const group = await StudentGroup.findOne({
      _id: groupId,
      educator_id: currentUser.requestorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    if (!studentIds.length) {
      return res.status(400).json({ error: 'No students provided for removal' });
    }

    // Convert strings to ObjectId
    const studentObjectIds = studentIds.map((id) => mongoose.Types.ObjectId(id));

    const result = await StudentGroupMember.deleteMany({
      group_id: mongoose.Types.ObjectId(groupId),
      student_id: { $in: studentObjectIds },
    });

    res.status(200).json({ removed: result.deletedCount });
  } catch (err) {
    console.error('REMOVE MEMBERS ERROR:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Update group details
 */
exports.updateGroup = async (req, res) => {
  try {
    const currentUser = req.body.requestor;
    const { groupId } = req.params;
    const { name, description } = req.body;

    if (!currentUser || !currentUser.requestorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const group = await StudentGroup.findOneAndUpdate(
      { _id: groupId, educator_id: currentUser.requestorId },
      { name, description },
      { new: true },
    );

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    res.status(200).json(group);
  } catch (err) {
    console.error('UPDATE GROUP ERROR:', err);
    res.status(400).json({ error: err.message });
  }
};

/**
 * Delete a group and its members
 */
exports.deleteGroup = async (req, res) => {
  try {
    const currentUser = req.body.requestor;
    const { groupId } = req.params;

    if (!currentUser || !currentUser.requestorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const group = await StudentGroup.findOneAndDelete({
      _id: groupId,
      educator_id: currentUser.requestorId,
    });

    if (!group) {
      return res.status(403).json({ error: 'Unauthorized access to group' });
    }

    await StudentGroupMember.deleteMany({ group_id: groupId });

    res.status(204).send();
  } catch (err) {
    console.error('DELETE GROUP ERROR:', err);
    res.status(400).json({ error: err.message });
  }
};
