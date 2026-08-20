const Badge = require('../models/Badge');
const { BADGE_DEFINITIONS, BADGE_TYPES } = require('../models/Badge');

// GET /api/badges
exports.getUserBadges = async (req, res, next) => {
  try {
    const earnedBadges = await Badge.find({ userId: req.user._id });
    const earnedTypes = new Set(earnedBadges.map(b => b.badgeType));

    // Build full badge list (earned + locked)
    const allBadges = BADGE_TYPES.map(type => {
      const def = BADGE_DEFINITIONS[type];
      const earned = earnedBadges.find(b => b.badgeType === type);

      return {
        badgeType: type,
        name: def.name,
        description: def.description,
        icon: def.icon,
        earned: earnedTypes.has(type),
        earnedAt: earned?.earnedAt || null
      };
    });

    res.json({
      success: true,
      data: {
        badges: allBadges,
        totalEarned: earnedBadges.length,
        totalAvailable: BADGE_TYPES.length
      }
    });
  } catch (error) {
    next(error);
  }
};
