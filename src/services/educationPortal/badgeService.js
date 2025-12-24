const epBadge = require('../../models/educationPortal/badgeModel');
const studentBadges = require('../../models/educationPortal/studentBadgesModel');

const DEFAULT_PAGE_LIMIT = 50;
const DEFAULT_LEADERBOARD_LIMIT = 10;

class BadgeService {
  /**
   * Get paginated badges with filtering
   */
  static async getAllBadges({ page = 1, limit = DEFAULT_PAGE_LIMIT, category, isActive = true } = {}) {
    const query = {};
    
    if (isActive !== undefined) {
      query.is_active = isActive;
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
  static async getBadgeById(badgeId) {
    const badge = await epBadge.findById(badgeId).lean();
    return badge;
  }

  /**
   * Create a new badge
   */
  static async createBadge(badgeData) {
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
  static async updateBadge(badgeId, updateData) {
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
  static async deleteBadge(badgeId) {
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
  static async getStudentBadges(studentId, { page = 1, limit = DEFAULT_PAGE_LIMIT, reason } = {}) {
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
  static async awardBadge({ studentId, badgeId, reason = 'manual_award', awardedBy, metadata = {} }) {
    // Verify badge exists and is active
    const badge = await epBadge.findOne({ _id: badgeId, is_active: true });
    if (!badge) {
      throw new Error('Badge not found or inactive');
    }

    // Check if student already has this badge (unless badge allows multiples)
    if (!badge.allow_multiple) {
      const existingBadge = await studentBadges.findOne({
        student_id: studentId,
        badge_id: badgeId,
        is_revoked: false,
      });

      if (existingBadge) {
        throw new Error('Student already has this badge');
      }
    }

    const NewStudentBadges = studentBadges;
    const newBadge = new NewStudentBadges({
      student_id: studentId,
      badge_id: badgeId,
      reason,
      awarded_by: awardedBy,
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
  static async revokeBadge(studentBadgeId, revokeReason = null) {
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
  static async getStudentBadgeStats(studentId) {
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
  static async bulkAwardBadges(awards) {
    const results = {
      successful: [],
      failed: [],
    };

    const awardPromises = awards.map(async (award) => {
      try {
        const badge = await this.awardBadge(award);
        return { success: true, award, badge };
      } catch (error) {
        return { success: false, award, error: error.message };
      }
    });

    const awardResults = await Promise.all(awardPromises);

    awardResults.forEach((result) => {
      if (result.success) {
        results.successful.push({ ...result.award, badge: result.badge });
      } else {
        results.failed.push({ ...result.award, error: result.error });
      }
    });

    return results;
  }

  /**
   * Get badge leaderboard
   */
  static async getBadgeLeaderboard({ limit = DEFAULT_LEADERBOARD_LIMIT, category = null } = {}) {
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
  static async awardBadgeOnCompletion(studentId, completionType, metadata) {
    try {
      // Find the appropriate badge for this completion
      const badge = await epBadge.findOne({
        category: completionType, // 'capstone' or 'lesson_completion'
        is_active: true,
      });

      if (!badge) {
        // eslint-disable-next-line no-console
        console.warn(`No badge found for completion type: ${completionType}`);
        return null;
      }

      // Award the badge
      return await this.awardBadge({
        studentId,
        badgeId: badge._id,
        reason: completionType === 'capstone' ? 'capstone_completion' : 'lesson_completion',
        awardedBy: null, // Automatic award
        metadata,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error awarding badge on completion:', error);
      return null;
    }
  }
}

module.exports = BadgeService;