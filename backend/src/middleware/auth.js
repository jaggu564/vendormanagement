/**
 * Authentication Middleware
 * Supports JWT and SSO authentication
 */
const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

const authenticate = async (req, res, next) => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from database with tenant info
    const userResult = await query(
      `SELECT u.*, t.id as tenant_id, t.name as tenant_name, t.data_region, t.hosting_type
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1 AND u.status = 'active' AND t.status = 'active'`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.rows[0];

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      data_region: user.data_region
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
      });
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'PERMISSION_DENIED',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Check if user has permission for specific module/action
 */
const checkPermission = async (userId, tenantId, module, action) => {
  try {
    const result = await query(
      `SELECT r.permissions
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1 AND r.tenant_id = $2`,
      [userId, tenantId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    // Check if any role has the required permission
    for (const row of result.rows) {
      const permissions = row.permissions;
      if (permissions[module] && permissions[module][action]) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
};

module.exports = {
  authenticate,
  authorize,
  checkPermission
};
