const epBadge = require('../../models/educationPortal/epBadgeModel');
const studentBadges = require('../../models/educationPortal/studentBadgesModel');

exports.getStudentBadges = async (req, res) => {
  try {
    const studentId = req.user._id;

    const badges = await studentBadges
      .find({ student_id: studentId, is_revoked: false })
      .populate('badge_id', 'name description image_url category')
      .populate('awarded_by', 'firstname lastname')
      .sort({ awarded_at: -1 });

    res.status(200).json({
      success: true,
      data: badges,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching student badges',
      error: error.message,
    });
  }
};

exports.awardBadge = async (req, res) => {
  try {
    const { student_id, badge_id, reason } = req.body;
    const awarded_by = req.user._id;

    const badge = await epBadge.findById(badge_id);
    if (!badge) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found',
      });
    }

    const existingBadge = await studentBadges.findOne({
      student_id,
      badge_id,
      is_revoked: false,
    });

    if (existingBadge) {
      return res.status(400).json({
        success: false,
        message: 'Student already has this badge',
      });
    }

    const newBadge = new studentBadges({
      student_id,
      badge_id,
      reason: reason || 'manual_award',
      awarded_by,
    });

    await newBadge.save();

    const populatedBadge = await newBadge
      .populate('badge_id', 'name description image_url category')
      .populate('awarded_by', 'firstname lastname');

    res.status(201).json({
      success: true,
      message: 'Badge awarded successfully',
      data: populatedBadge,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error awarding badge',
      error: error.message,
    });
  }
};

exports.revokeBadge = async (req, res) => {
  try {
    const { student_badge_id } = req.params;

    const badge = await studentBadges.findByIdAndUpdate(
      student_badge_id,
      {
        is_revoked: true,
        revoked_at: new Date(),
      },
      { new: true }
    );

    if (!badge) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Badge revoked successfully',
      data: badge,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error revoking badge',
      error: error.message,
    });
  }
};

exports.createBadge = async (req, res) => {
  try {
    const { name, description, image_url, category } = req.body;

    if (!name || !description || !image_url) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, and image_url are required',
      });
    }

    const newBadge = new epBadge({
      name,
      description,
      image_url,
      category: category || 'achievement',
      is_active: true,
    });

    await newBadge.save();

    res.status(201).json({
      success: true,
      message: 'Badge created successfully',
      data: newBadge,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating badge',
      error: error.message,
    });
  }
};

exports.getAllBadges = async (req, res) => {
  try {
    const badges = await epBadge.find({ is_active: true }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: badges,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching badges',
      error: error.message,
    });
  }
};

exports.updateBadge = async (req, res) => {
  try {
    const { badge_id } = req.params;
    const { name, description, image_url, category, is_active } = req.body;

    const badge = await epBadge.findByIdAndUpdate(
      badge_id,
      {
        name,
        description,
        image_url,
        category,
        is_active,
      },
      { new: true, runValidators: true }
    );

    if (!badge) {
      return res.status(404).json({
        success: false,
        message: 'Badge not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Badge updated successfully',
      data: badge,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating badge',
      error: error.message,
    });
  }
};

exports.getStudentBadgesByReason = async (req, res) => {
  try {
    const { reason } = req.params;
    const studentId = req.user._id;

    const badges = await studentBadges
      .find({ student_id: studentId, reason, is_revoked: false })
      .populate('badge_id', 'name description image_url category')
      .populate('awarded_by', 'firstname lastname')
      .sort({ awarded_at: -1 });

    res.status(200).json({
      success: true,
      data: badges,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching badges by reason',
      error: error.message,
    });
  }
};

exports.awardBadgeAutomatically = async (studentId, badgeId, reason) => {
  try {
    const existingBadge = await studentBadges.findOne({
      student_id: studentId,
      badge_id: badgeId,
      is_revoked: false,
    });

    if (existingBadge) {
      return null; 
    }

    const newBadge = new studentBadges({
      student_id: studentId,
      badge_id: badgeId,
      reason,
    });

    await newBadge.save();
    return newBadge;
  } catch (error) {
    console.error('Error awarding badge automatically:', error);
    return null;
  }
};