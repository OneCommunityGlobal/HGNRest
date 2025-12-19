const epBadge = require('../../models/educationPortal/badgeModel');
const studentBadges = require('../../models/educationPortal/studentBadgesModel');

class BadgeService {
  /**
   * Get paginated badges with filtering
   */
  async getAllBadges({ page = 1, limit = 50, category, is_active = true } = {}) {
    const query = {};
    
    if (is_active !== undefined) {
      query.is_active = is_active;
    }
    
    if (category) {
      query.category = category;
    }

    const skip = (page - 1) * limit;

    const [badges, total] = await Promise.all([
      epBadge
        .find(query)
        .sort({ ranking: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      epBadge.countDocuments(query),
    ]);

    return {
      badges,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get badge by ID
   */
  async getBadgeById(badgeId) {
    const badge = await epBadge.findById(badgeId).lean();
    return badge;
  }

  /**
   * Create a new badge
   */
  async createBadge(badgeData) {
    // Check for duplicate name
    const existingBadge = await epBadge.findOne({
      name: { $regex: new RegExp(`^${badgeData.name}$`, 'i') },
    });

    if (existingBadge) {
      throw new Error('A badge with this name already exists');
    }

    const badge = new epBadge(badgeData);
    await badge.save();
    return badge.toObject();
  }

  /**
   * Update a badge
   */
  async updateBadge(badgeId, updateData) {
    // If name is being updated, check for duplicates
    if (updateData.name) {
      const existingBadge = await epBadge.findOne({
        _id: { $ne: badgeId },
        name: { $regex: new RegExp(`^${updateData.name}$`, 'i') },
      });

      if (existingBadge) {
        throw new Error('A badge with this name already exists');
      }
    }

    const badge = await epBadge.findByIdAndUpdate(
      badgeId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!badge) {
      throw new Error('Badge not found');
    }

    return badge.toObject();
  }

  /**
   * Soft delete a badge
   */
  async deleteBadge(badgeId) {
    const badge = await epBadge.findByIdAndUpdate(
      badgeId,
      { $set: { is_active: false } },
      { new: true }
    );

    if (!badge) {
      throw new Error('Badge not found');
    }

    return badge;
  }

  /**
   * Get student badges with pagination
   */
  async getStudentBadges(studentId, { page = 1, limit = 50, reason } = {}) {
    const query = {
      student_id: studentId,
      is_revoked: false,
    };

    if (reason) {
      query.reason = reason;
    }

    const skip = (page - 1) * limit;

    const [badges, total] = await Promise.all([
      studentBadges
        .find(query)
        .populate('badge_id', 'name description image_url category points')
        .populate('awarded_by', 'firstname lastname')
        .sort({ awarded_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      studentBadges.countDocuments(query),
    ]);

    return {
      badges,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Award a badge to a student
   */
  async awardBadge({ student_id, badge_id, reason = 'manual_award', awarded_by, metadata = {} }) {
    // Verify badge exists and is active
    const badge = await epBadge.findOne({ _id: badge_id, is_active: true });
    if (!badge) {
      throw new Error('Badge not found or inactive');
    }

    // Check if student already has this badge (unless badge allows multiples)
    if (!badge.allow_multiple) {
      const existingBadge = await studentBadges.findOne({
        student_id,
        badge_id,
        is_revoked: false,
      });

      if (existingBadge) {
        throw new Error('Student already has this badge');
      }
    }

    const newBadge = new studentBadges({
      student_id,
      badge_id,
      reason,
      awarded_by,
      metadata,
    });

    await newBadge.save();
    
    await newBadge.populate([
      { path: 'badge_id', select: 'name description image_url category points' },
      { path: 'awarded_by', select: 'firstname lastname' },
    ]);

    return newBadge.toObject();
  }

  /**
   * Revoke a student's badge
   */
  async revokeBadge(studentBadgeId, revokeReason = null) {
    const badge = await studentBadges.findByIdAndUpdate(
      studentBadgeId,
      {
        $set: {
          is_revoked: true,
          revoked_at: new Date(),
          revoke_reason: revokeReason,
        },
      },
      { new: true }
    );

    if (!badge) {
      throw new Error('Badge assignment not found');
    }

    return badge;
  }

  /**
   * Get badge statistics for a student
   */
  async getStudentBadgeStats(studentId) {
    const stats = await studentBadges.aggregate([
      {
        $match: {
          student_id: studentId,
          is_revoked: false,
        },
      },
      {
        $lookup: {
          from: 'epbadges',
          localField: 'badge_id',
          foreignField: '_id',
          as: 'badge',
        },
      },
      {
        $unwind: '$badge',
      },
      {
        $group: {
          _id: '$badge.category',
          count: { $sum: 1 },
          totalPoints: { $sum: '$badge.points' },
        },
      },
    ]);

    const totalBadges = await studentBadges.countDocuments({
      student_id: studentId,
      is_revoked: false,
    });

    const totalPoints = stats.reduce((sum, stat) => sum + (stat.totalPoints || 0), 0);

    return {
      totalBadges,
      totalPoints,
      byCategory: stats,
    };
  }

  /**
   * Bulk award badges
   */
  async bulkAwardBadges(awards) {
    const results = {
      successful: [],
      failed: [],
    };

    for (const award of awards) {
      try {
        const badge = await this.awardBadge(award);
        results.successful.push({ ...award, badge });
      } catch (error) {
        results.failed.push({ ...award, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get badge leaderboard
   */
  async getBadgeLeaderboard({ limit = 10, category = null } = {}) {
    const matchStage = { is_revoked: false };

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'epbadges',
          localField: 'badge_id',
          foreignField: '_id',
          as: 'badge',
        },
      },
      { $unwind: '$badge' },
    ];

    if (category) {
      pipeline.push({ $match: { 'badge.category': category } });
    }

    pipeline.push(
      {
        $group: {
          _id: '$student_id',
          badgeCount: { $sum: 1 },
          totalPoints: { $sum: '$badge.points' },
        },
      },
      { $sort: { totalPoints: -1, badgeCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      {
        $project: {
          student_id: '$_id',
          badgeCount: 1,
          totalPoints: 1,
          'student.firstname': 1,
          'student.lastname': 1,
        },
      }
    );

    const leaderboard = await studentBadges.aggregate(pipeline);
    return leaderboard;
  }

  /**
 * Award badge automatically when capstone/lesson is completed
 * This should be called from your existing task grading service
 */
async awardBadgeOnCompletion(studentId, completionType, metadata) {
  try {
    // Find the appropriate badge for this completion
    const badge = await epBadge.findOne({
      category: completionType, // 'capstone' or 'lesson_completion'
      is_active: true,
    });

    if (!badge) {
      console.warn(`No badge found for completion type: ${completionType}`);
      return null;
    }

    // Award the badge
    return await this.awardBadge({
      student_id: studentId,
      badge_id: badge._id,
      reason: completionType === 'capstone' ? 'capstone_completion' : 'lesson_completion',
      awarded_by: null, // Automatic award
      metadata,
    });
  } catch (error) {
    console.error('Error awarding badge on completion:', error);
    return null;
  }
}
}

module.exports = new BadgeService();