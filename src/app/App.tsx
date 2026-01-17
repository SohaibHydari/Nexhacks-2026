import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext';
import { DataProvider } from '@/app/contexts/DataContext';
import { TopNav } from '@/app/components/ics/TopNav';
import { SideNav } from '@/app/components/ics/SideNav';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { IncidentSelectScreen } from '@/app/screens/IncidentSelectScreen';
import { ICDashboard } from '@/app/screens/ICDashboard';
import { FieldHomeScreen } from '@/app/screens/FieldHomeScreen';
import { CreateRequestScreen } from '@/app/screens/CreateRequestScreen';
import { BulletinsScreen } from '@/app/screens/BulletinsScreen';
import { HospitalScreen } from '@/app/screens/HospitalScreen';
import { InventoryScreen } from '@/app/screens/InventoryScreen';
import { PlanningScreen } from '@/app/screens/PlanningScreen';
import { FinanceScreen } from '@/app/screens/FinanceScreen';
import { EventLogScreen } from '@/app/screens/EventLogScreen';
import { RequestDetailDrawer } from '@/app/screens/RequestDetailDrawer';
import { Request, Bulletin } from '@/app/contexts/DataContext';
import { Toaster } from '@/app/components/ui/sonner';

const AppContent: React.FC = () => {
  const { user, incident } = useAuth();
  const [currentPath, setCurrentPath] = useState('/dashboard');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);

  // If not logged in, show login screen
  if (!user) {
    return <LoginScreen onLogin={() => setCurrentPath('/select-incident')} />;
  }

  // If logged in but no incident selected, show incident select
  if (!incident) {
    return <IncidentSelectScreen onSelect={() => {
      // Navigate to role-specific home
      if (user.role === 'IC') setCurrentPath('/dashboard');
      else if (user.role === 'EMS' || user.role === 'Fire') setCurrentPath('/field');
      else if (user.role === 'Hospital') setCurrentPath('/hospital');
      else if (user.role === 'Logistics') setCurrentPath('/inventory');
      else if (user.role === 'Planning') setCurrentPath('/planning');
      else if (user.role === 'Finance') setCurrentPath('/finance');
    }} />;
  }

  // Main application layout
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopNav />
      <div className="flex-1 flex overflow-hidden">
        <SideNav currentPath={currentPath} onNavigate={setCurrentPath} />
        <main className="flex-1 overflow-y-auto">
          {/* IC Routes */}
          {user.role === 'IC' && currentPath === '/dashboard' && <ICDashboard />}
          
          {/* EMS/Fire Routes */}
          {(user.role === 'EMS' || user.role === 'Fire') && currentPath === '/field' && (
            <FieldHomeScreen
              onNavigateToCreateRequest={() => setCurrentPath('/create-request')}
              onNavigateToBulletins={() => setCurrentPath('/bulletins')}
              onViewRequest={setSelectedRequest}
              onViewBulletin={setSelectedBulletin}
            />
          )}
          {(user.role === 'EMS' || user.role === 'Fire') && currentPath === '/create-request' && (
            <CreateRequestScreen onSuccess={() => setCurrentPath('/field')} />
          )}
          {(user.role === 'EMS' || user.role === 'Fire') && currentPath === '/bulletins' && (
            <BulletinsScreen />
          )}
          
          {/* Hospital Routes */}
          {user.role === 'Hospital' && currentPath === '/hospital' && <HospitalScreen />}
          
          {/* Logistics Routes */}
          {user.role === 'Logistics' && currentPath === '/inventory' && <InventoryScreen />}
          
          {/* Planning Routes */}
          {user.role === 'Planning' && currentPath === '/planning' && <PlanningScreen />}
          
          {/* Finance Routes */}
          {user.role === 'Finance' && currentPath === '/finance' && <FinanceScreen />}
          
          {/* Event Log (all roles) */}
          {currentPath === '/event-log' && <EventLogScreen />}
        </main>
      </div>

      {/* Global Drawers */}
      {selectedRequest && (
        <RequestDetailDrawer
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}
      
      <Toaster />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
