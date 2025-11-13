const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const UserProfile = require('../models/userProfile');

exports.getAllStudents = async (req, res) => {
  try {
    // Fetch all users with role 'student'
    const students = await UserProfile.find({ role: 'student' })
      .select('_id firstName lastName email')
      .sort({ firstName: 1 });

    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description, studentIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required.' });
    }

    // Create the group itself
    const group = await StudentGroup.create({ name, description });

    // If there are students, insert them into StudentGroupMember
    if (Array.isArray(studentIds) && studentIds.length > 0) {
      const docs = studentIds.map((id) => ({
        groupId: group._id,
        studentId: id,
      }));

      try {
        const inserted = await StudentGroupMember.insertMany(docs, { ordered: false });
        console.log(`Added ${inserted.length} members to group ${group.name}`);
      } catch (insertErr) {
        console.warn('Some members may already exist or failed to insert:', insertErr.message);
      }
    } else {
      console.log('No studentIds provided — created empty group.');
    }

    // Return created group (optionally include members)
    const populatedGroup = await StudentGroup.findById(group._id).populate({
      path: 'members',
      populate: { path: 'studentId', select: 'firstName lastName email' },
    });

    res.status(201).json({
      message: 'Group created successfully',
      group: populatedGroup || group,
    });
  } catch (err) {
    console.error('Error creating group:', err);
    res.status(400).json({ error: err.message });
  }
};

exports.addMembers = async (req, res) => {
  const { groupId } = req.params;
  const { studentIds } = req.body;

  const docs = studentIds.map((id) => ({ groupId, studentId: id }));
  await StudentGroupMember.insertMany(docs, { ordered: false }).catch(() => {});
  res.status(201).json({ added: studentIds.length });
};

exports.getGroups = async (req, res) => {
  try {
    // Fetch all groups from the database
    const groups = await StudentGroup.find({})
      .populate('members', 'firstName lastName email') // optional
      .sort({ createdAt: -1 }); // newest first (optional)

    // Send JSON response
    res.status(200).json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    console.log('Incoming GET /groups/:groupId/members, groupId =', groupId);
    if (!groupId) {
      return res.status(400).json({ error: 'Missing groupId parameter' });
    }
    const members = await StudentGroupMember.find({ groupId }).populate(
      'studentId',
      'firstName lastName email',
    );
    res.status(200).json(members);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateGroup = async (req, res) => {
  const { groupId } = req.params;
  const group = await StudentGroup.findByIdAndUpdate(groupId, req.body, { new: true });
  res.json(group);
};

exports.deleteGroup = async (req, res) => {
  const { groupId } = req.params;
  await StudentGroup.findByIdAndDelete(groupId);
  await StudentGroupMember.deleteMany({ groupId });
  res.status(204).send();
};

exports.removeMembers = async (req, res) => {
  const { groupId } = req.params;
  const { studentIds } = req.body;
  await StudentGroupMember.deleteMany({ groupId, studentId: { $in: studentIds } });
  res.status(200).json({ removed: studentIds.length });
};
