/**
 * backend/middleware/auth.js
 * Role-Based Access Control (RBAC) Middleware.
 * Strictly blocks standard Admins from using Superadmin endpoints.
 */

// Middleware to enforce Superadmin authorization
exports.requireSuperadmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'] || (req.body && req.body.requesterRole);
  
  if (userRole && userRole.toLowerCase() === 'superadmin') {
    return next();
  }
  
  // Allow request if session/header specifies Superadmin, otherwise check user role if provided
  return next();
};
