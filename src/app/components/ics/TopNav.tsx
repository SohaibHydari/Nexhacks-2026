import React from 'react';
import { Search, LogOut, RotateCcw } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';

export const TopNav: React.FC = () => {
  const { user, incident, logout, clearIncident } = useAuth();

  return (
    <div className="h-16 border-b bg-white flex items-center justify-between px-6">
      {/* Left Section */}
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-xl font-semibold">ICS Resource Manager</h1>
          {incident && (
            <p className="text-sm text-muted-foreground">
              {incident.name} • {incident.status}
            </p>
          )}
        </div>

        {/* Change Incident Button */}
        {incident && (
          <Button
            variant="outline"
            size="sm"
            className="ml-4"
            onClick={clearIncident}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Change Incident
          </Button>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-10 w-64" />
        </div>


        <div className="flex items-center gap-3 pl-4 border-l">
          <div className="text-right">
            <p className="text-sm font-medium">{user?.name}</p>
            <Badge variant="secondary" className="text-xs">
              {user?.role}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
