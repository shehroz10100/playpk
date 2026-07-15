/** Role → post-login home path for the unified dashboard portal. */
export function homePathForRole(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'COMPANY_OWNER':
    case 'BRANCH_MANAGER':
      return '/companies';
    case 'PLAYER':
      return '/discover';
    default:
      return '/login';
  }
}

export function isStaffRole(role: string): boolean {
  return role === 'COMPANY_OWNER' || role === 'BRANCH_MANAGER' || role === 'ADMIN';
}

export function isPlayerRole(role: string): boolean {
  return role === 'PLAYER';
}

export function isAdminRole(role: string): boolean {
  return role === 'ADMIN';
}
