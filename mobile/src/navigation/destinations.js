const STAFF = [
  'super_admin',
  'admin',
  'moderator',
  'content_manager',
  'finance_manager',
  'support_agent',
];

export function isStaffUser(user) {
  const roles = user?.roles || [];
  const caps = user?.capabilities || {};
  return Boolean(
    caps.superAdmin ||
      caps.adminConsole ||
      user?.isAdmin ||
      STAFF.some((role) => roles.includes(role))
  );
}

export function isCreatorUser(user) {
  const roles = user?.roles || [];
  const caps = user?.capabilities || {};
  return Boolean(
    caps.creatorStudio ||
      roles.includes('creator') ||
      roles.includes('filmmaker') ||
      roles.includes('producer')
  );
}

export function isAdvertiserUser(user) {
  const roles = user?.roles || [];
  return Boolean(user?.capabilities?.adsPortal || roles.includes('advertiser'));
}

/** Destino após login: um espaço de trabalho, não o catálogo por omissão. */
export function workspacePath(user) {
  if (isStaffUser(user) && (user?.roles || []).includes('super_admin')) return '/admin';
  if (isStaffUser(user)) return '/admin';
  if (isCreatorUser(user)) return '/creator-studio';
  if (isAdvertiserUser(user)) return '/ads';
  return '/home';
}
