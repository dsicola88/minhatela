'use strict';

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');
const authSessionRepository = require('../repositories/authSessionRepository');

async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(createError(401, 'Autenticação necessária', 'UNAUTHORIZED'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: payload.sub,
      email: payload.email,
      subscriptionStatus: payload.subscriptionStatus,
      roles: payload.roles || [],
      isAdmin: Boolean(payload.isAdmin),
      sessionId: payload.sid || null,
    };

    // Sessões com sid: revogar no servidor invalida o access token
    if (payload.sid) {
      const session = await authSessionRepository.findActiveById(payload.sid, payload.sub);
      if (!session) {
        return next(createError(401, 'Sessão terminada. Entre novamente.', 'SESSION_REVOKED'));
      }
      authSessionRepository.touch(payload.sid).catch(() => {});
    }

    return next();
  } catch {
    return next(createError(401, 'Sessão inválida ou expirada', 'INVALID_TOKEN'));
  }
}

function requireRoles(...roles) {
  return (req, _res, next) => {
    const userRoles = req.user?.roles || [];
    const allowed =
      req.user?.isAdmin ||
      roles.some((role) => userRoles.includes(role));

    if (!allowed) {
      return next(createError(403, 'Permissão insuficiente', 'FORBIDDEN'));
    }
    return next();
  };
}

/** Exige role exacta (isAdmin sozinho não basta) — ops críticas Netflix-class */
function requireExactRoles(...roles) {
  return (req, _res, next) => {
    const userRoles = req.user?.roles || [];
    const allowed = roles.some((role) => userRoles.includes(role));
    if (!allowed) {
      return next(createError(403, 'Permissão insuficiente', 'FORBIDDEN'));
    }
    return next();
  };
}

function optionalProfile(req, _res, next) {
  const profileId = req.headers['x-profile-id'] || req.body?.profileId || null;
  req.profileId = profileId || null;
  next();
}

module.exports = { requireAuth, requireRoles, requireExactRoles, optionalProfile };
