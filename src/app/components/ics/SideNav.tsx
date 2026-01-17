import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  MapPin, 
  Package, 
  ClipboardList, 
  DollarSign, 
  PlusCircle,
  Bell,
  ScrollText,
  Building2
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Role } from '@/app/contexts/AuthContext';
import { cn } from '@/app/components/ui/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItemsByRole: Record<Role, NavItem[]> = {
  IC: [
    { label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, path: '/dashboard' },
    { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  ],
  EMSFire: [
    { label: 'Field Home', icon: <MapPin className="h-4 w-4" />, path: '/field' },
    { label: 'Create Request', icon: <PlusCircle className="h-4 w-4" />, path: '/create-request' },
    { label: 'Bulletins', icon: <Bell className="h-4 w-4" />, path: '/bulletins' },
    { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  ],
  // Fire: [
  //   { label: 'Field Home', icon: <MapPin className="h-4 w-4" />, path: '/field' },
  //   { label: 'Create Request', icon: <PlusCircle className="h-4 w-4" />, path: '/create-request' },
  //   { label: 'Bulletins', icon: <Bell className="h-4 w-4" />, path: '/bulletins' },
  //   { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  // ],
  // Hospital: [
  //   { label: 'Hospital Updates', icon: <Building2 className="h-4 w-4" />, path: '/hospital' },
  //   { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  // ],
  // Logistics: [
  //   { label: 'Inventory', icon: <Package className="h-4 w-4" />, path: '/inventory' },
  //   { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  // ],
  // Planning: [
  //   { label: 'Planning Board', icon: <ClipboardList className="h-4 w-4" />, path: '/planning' },
  //   { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  // ],
  // Finance: [
  //   { label: 'Finance Overview', icon: <DollarSign className="h-4 w-4" />, path: '/finance' },
  //   { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  // ],
};

interface SideNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const SideNav: React.FC<SideNavProps> = ({ currentPath, onNavigate }) => {
  const { user } = useAuth();
  
  if (!user) return null;
  
  const navItems = navItemsByRole[user.role];

  return (
    <div className="w-64 border-r bg-white h-full">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
              currentPath === item.path
                ? "bg-primary text-primary-foreground"
                : "hover:bg-accent text-foreground"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
