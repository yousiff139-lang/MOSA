export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUPER_OWNER = 'SUPER_OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  GUEST = 'GUEST'
}

export type NavItem = {
  title: string;
  href?: string;
  icon?: any; // Lucide icon component
  isHeader?: boolean;
  isSpacer?: boolean;
  allowedRoles: Role[];
  children?: NavItem[];
};

export type Tenant = {
  id: string;
  name: string;
  role: Role;
  isActive?: boolean;
};

// Global Role Hierarchy (Higher is more privileged)
export const RoleHierarchy: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 50,
  [Role.SUPER_OWNER]: 40,
  [Role.ADMIN]: 30,
  [Role.MEMBER]: 20,
  [Role.GUEST]: 10,
};
