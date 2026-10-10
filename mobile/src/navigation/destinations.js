const STAFF = [
  'super_admin',
  'admin',
  'moderator',
  'content_manager',
  'finance_manager',
  'support_agent',
];

/** Destino após login ou escolha de perfil, pelo papel principal. */
export function workspacePath(user) {
  const roles = user?.roles || [];
  const caps = user?.capabilities || {};
  if (roles.includes('super_admin') || caps.superAdmin) return '/admin';
  if (caps.adminConsole || user?.isAdmin || STAFF.some((role) => roles.includes(role))) {
    return '/admin';
  }
  if (
    caps.creatorStudio ||
    roles.includes('creator') ||
    roles.includes('producer') ||
    roles.includes('filmmaker')
  ) {
    return '/creator-studio';
  }
  if (roles.includes('advertiser')) return '/ads';
  return '/home';
}
