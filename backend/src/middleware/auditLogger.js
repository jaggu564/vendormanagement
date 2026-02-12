/**
 * Audit Logging Middleware
 * Logs all privileged actions with immutable, tamper-evident records
 */
const { query } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

// Actions that require audit logging
const AUDITABLE_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'LOCK', 'UNLOCK',
  'APPROVE', 'REJECT', 'OVERRIDE', 'DOWNLOAD',
  'EXPORT', 'ACCESS_GRANT', 'ACCESS_REVOKE',
  'CONFIG_CHANGE', 'INTEGRATION_CREATE', 'INTEGRATION_UPDATE'
];

const auditLogger = async (req, res, next) => {
  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;

  // Override res.json to capture response
  res.json = function(body) {
    res.locals.responseBody = body;
    return originalJson.call(this, body);
  };

  res.send = function(body) {
    res.locals.responseBody = body;
    return originalSend.call(this, body);
  };

  // Log after response is sent
  res.on('finish', async () => {
    try {
      const action = req.method;
      const resourceType = req.route?.path || req.path;
      const statusCode = res.statusCode;

      // Only log if action is auditable or status indicates privileged action
      const shouldAudit = AUDITABLE_ACTIONS.some(a => 
        action.includes(a) || req.path.includes(a.toLowerCase())
      ) || statusCode >= 400 || req.user;

      if (shouldAudit && req.tenantId) {
        const auditData = {
          tenant_id: req.tenantId,
          user_id: req.user?.id || null,
          action: `${action} ${req.path}`,
          resource_type: resourceType,
          resource_id: req.params?.id || req.body?.id || null,
          module: extractModule(req.path),
          details: {
            method: req.method,
            path: req.path,
            query: req.query,
            body: sanitizeBody(req.body),
            status_code: statusCode,
            response: sanitizeResponse(res.locals.responseBody),
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent')
          },
          ip_address: req.ip || req.connection.remoteAddress,
          user_agent: req.get('user-agent'),
          timestamp: new Date()
        };

        // Insert audit log (async, don't block response)
        query(
          `INSERT INTO audit_logs 
           (tenant_id, user_id, action, resource_type, resource_id, module, details, ip_address, user_agent, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            auditData.tenant_id,
            auditData.user_id,
            auditData.action,
            auditData.resource_type,
            auditData.resource_id,
            auditData.module,
            JSON.stringify(auditData.details),
            auditData.ip_address,
            auditData.user_agent,
            auditData.timestamp
          ]
        ).catch(err => {
          console.error('Audit log insertion failed:', err);
          // Don't throw - audit logging should not break the application
        });
      }
    } catch (error) {
      console.error('Audit logger error:', error);
      // Silent fail - don't break the request
    }
  });

  next();
};

function extractModule(path) {
  if (path.includes('/rfp')) return 'rfp';
  if (path.includes('/contract')) return 'contract';
  if (path.includes('/procurement')) return 'procurement';
  if (path.includes('/performance')) return 'performance';
  if (path.includes('/risk')) return 'risk';
  if (path.includes('/analytics')) return 'analytics';
  if (path.includes('/helpdesk')) return 'helpdesk';
  if (path.includes('/survey')) return 'survey';
  if (path.includes('/integration')) return 'integration';
  if (path.includes('/admin')) return 'admin';
  return 'general';
}

function sanitizeBody(body) {
  if (!body) return null;
  const sanitized = { ...body };
  // Remove sensitive fields
  if (sanitized.password) sanitized.password = '[REDACTED]';
  if (sanitized.password_hash) sanitized.password_hash = '[REDACTED]';
  if (sanitized.token) sanitized.token = '[REDACTED]';
  return sanitized;
}

function sanitizeResponse(response) {
  if (!response) return null;
  // Only log response metadata, not full response bodies
  if (typeof response === 'object') {
    return {
      success: response.success !== undefined ? response.success : null,
      error: response.error || null,
      count: response.count || response.data?.length || null
    };
  }
  return null;
}

module.exports = { auditLogger };
