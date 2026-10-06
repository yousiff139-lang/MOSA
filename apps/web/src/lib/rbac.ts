import { Role, RoleHierarchy, NavItem } from '../types/navigation';
import { 
  Home, Grid, Layers, Cpu, Server, Activity, 
  ShieldAlert, Settings, Users, CreditCard, Puzzle, BarChart3, ShieldCheck, UserCog
} from 'lucide-react';

export const hasPermission = (userRole: Role, requiredRole: Role): boolean => {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
};

export const filterNavItems = (items: NavItem[], userRole: Role): NavItem[] => {
  return items.filter(item => {
    // Spacer and Headers don't have roles, check if they should be rendered based on context
    if (item.isSpacer) return true;
    
    // Check if the user has any of the allowed roles for this item
    const hasAccess = item.allowedRoles.some(role => hasPermission(userRole, role));
    
    if (!hasAccess) return false;

    // Filter children recursively
    if (item.children) {
      item.children = filterNavItems(item.children, userRole);
      // Don't show parent if all children are filtered out
      if (item.children.length === 0 && !item.href) return false;
    }

    return true;
  });
};

// Global Navigation Architecture
export const SIDEBAR_NAVIGATION: NavItem[] = [
  // 🏠 Home Context
  { title: "sidebar.header.dashboard", isHeader: true, allowedRoles: [Role.GUEST] },
  { title: "sidebar.dashboard", href: "/", icon: Home, allowedRoles: [Role.GUEST] },
  
  { isSpacer: true, title: "", allowedRoles: [] },

  // 📱 Devices Layer
  { title: "sidebar.header.devices", isHeader: true, allowedRoles: [Role.GUEST] },
  { title: "sidebar.devices", href: "/devices", icon: Cpu, allowedRoles: [Role.GUEST] },
  { title: "sidebar.rooms", href: "/rooms", icon: Grid, allowedRoles: [Role.MEMBER] },
  { title: "sidebar.registry", href: "/devices/registry", icon: Layers, allowedRoles: [Role.ADMIN] },

  { isSpacer: true, title: "", allowedRoles: [] },

  // 🤖 Automation Layer
  { title: "sidebar.header.intelligence", isHeader: true, allowedRoles: [Role.MEMBER] },
  { title: "sidebar.automations", href: "/automations", icon: Server, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.scenes", href: "/scenes", icon: Puzzle, allowedRoles: [Role.MEMBER] },
  { title: "sidebar.ai_assistant", href: "/ai", icon: Activity, allowedRoles: [Role.MEMBER] },

  { isSpacer: true, title: "", allowedRoles: [] },

  // 📊 Analytics Layer
  { title: "sidebar.header.analytics", isHeader: true, allowedRoles: [Role.MEMBER] },
  { title: "sidebar.energy", href: "/analytics", icon: BarChart3, allowedRoles: [Role.MEMBER] },
  { title: "sidebar.logs", href: "/logs", icon: Activity, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.reports", href: "/reports", icon: BarChart3, allowedRoles: [Role.ADMIN] },

  { isSpacer: true, title: "", allowedRoles: [] },

  // 🌐 Infrastructure Layer
  { title: "sidebar.header.infrastructure", isHeader: true, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.edge_nodes", href: "/infrastructure/nodes", icon: Server, allowedRoles: [Role.SUPER_OWNER] },
  { title: "sidebar.mqtt_gateway", href: "/infrastructure/mqtt", icon: Activity, allowedRoles: [Role.SUPER_OWNER] },
  { title: "sidebar.system_health", href: "/infrastructure/health", icon: ShieldCheck, allowedRoles: [Role.SUPER_OWNER] },
  { title: "تحديث النظام (OTA)", href: "/ota", icon: Server, allowedRoles: [Role.SUPER_OWNER] },

  { isSpacer: true, title: "", allowedRoles: [] },

  // 👥 Admin Layer
  { title: "sidebar.header.administration", isHeader: true, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.users", href: "/admin/users", icon: Users, allowedRoles: [Role.SUPER_OWNER] },
  { title: "sidebar.security", href: "/admin/security", icon: ShieldCheck, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.billing", href: "/billing", icon: CreditCard, allowedRoles: [Role.SUPER_OWNER] },
  
  { isSpacer: true, title: "", allowedRoles: [] },

  // ⚙️ Settings Layer
  { title: "sidebar.header.system", isHeader: true, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.settings", href: "/settings", icon: Settings, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.marketplace", href: "/settings/plugins", icon: Puzzle, allowedRoles: [Role.ADMIN] },
  { title: "sidebar.advanced_security", href: "/settings/security", icon: ShieldAlert, allowedRoles: [Role.SUPER_OWNER] },
];
