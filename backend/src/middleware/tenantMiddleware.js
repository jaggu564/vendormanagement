/**
 * Tenant Isolation Middleware
 * Ensures all requests are scoped to a tenant
 */

const { query } = require('../database/connection');

const tenantMiddleware = async (req, res, next) => {
  try {
    // ✅ Skip tenant enforcement for auth routes
    if (req.originalUrl.startsWith('/api/v1/auth')) {
      return next();
    }

    // Get tenant ID from authenticated user (JWT)
    let tenantId = req.user?.tenant_id || req.user?.tenantId;

    // Dev fallback (optional)
    if (!tenantId && process.env.NODE_ENV === 'development') {
      tenantId = process.env.DEFAULT_TENANT_ID;
    }

    if (!tenantId) {
      return res.status(401).json({
        error: 'Tenant identification required',
        code: 'TENANT_REQUIRED',
      });
    }

    // Verify tenant exists and is active
    const tenantResult = await query(
      'SELECT id, name, status, data_region, hosting_type FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      });
    }

    const tenant = tenantResult.rows[0];

    if (tenant.status !== 'active') {
      return res.status(403).json({
        error: 'Tenant is not active',
        code: 'TENANT_INACTIVE',
      });
    }

    // Attach tenant info to request
    req.tenant = tenant;
    req.tenantId = tenant.id;

    // Optional query context
    req.queryContext = {
      tenantId: tenant.id,
      dataRegion: tenant.data_region,
    };

    next();
  } catch (error) {
    console.error('Tenant middleware error:', error);
    res.status(500).json({
      error: 'Tenant validation failed',
      code: 'TENANT_VALIDATION_ERROR',
    });
  }
};

module.exports = { tenantMiddleware };
