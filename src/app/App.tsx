import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext';
import { DataProvider } from '@/app/contexts/DataContext';
import { TopNav } from '@/app/components/ics/TopNav';
import { SideNav } from '@/app/components/ics/SideNav';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { IncidentSelectScreen } from '@/app/screens/IncidentSelectScreen';
import { ICDashboard } from '@/app/screens/ICDashboard';
import { FieldHomeScreen } from '@/app/screens/FieldHomeScreen';
import { RequestDetailDrawer } from '@/app/screens/RequestDetailDrawer';
import { Request, Bulletin } from '@/app/contexts/DataContext';
import { Toaster } from '@/app/components/ui/sonner';
import { Button } from '@/app/components/ui/button';
import { EventLogScreen } from '@/app/screens/EventLogScreen';

const AppContent: React.FC = () => {
  const { user, incident, clearIncident } = useAuth();
  const [currentPath, setCurrentPath] = useState('/dashboard');
  // const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  // const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);

  const goToIncidentSelect = () => {
    // close any drawers/modals
    // setSelectedRequest(null);
    // setSelectedBulletin(null);

    // clear incident + route to select screen
    clearIncident();
    setCurrentPath('/select-incident');
  };

  // If not logged in, show login screen
  if (!user) {
    return <LoginScreen onLogin={() => setCurrentPath('/select-incident')} />;
  }

  // If logged in but no incident selected, show incident select
  if (!incident) {
    return (
      <IncidentSelectScreen
        onSelect={() => {
          // Navigate to role-specific home
          if (user.role === 'IC') setCurrentPath('/dashboard');
          else if (user.role === 'EMSFire') setCurrentPath('/field');
        }}
      />
    );
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
          {user.role === 'IC' && currentPath === '/event-log' && (<EventLogScreen />)}

          {/* EMS/Fire Routes */}
          {user.role === 'EMSFire' && currentPath === '/event-log' && (<EventLogScreen />)}
          {user.role === 'EMSFire' && currentPath === '/field' && (
            <FieldHomeScreen/>
          )}
        </main>
      </div>

      {/* Global Drawers */}
      {/* {selectedRequest && (
        <RequestDetailDrawer request={selectedRequest} onClose={() => setSelectedRequest(null)} />
      )} */}

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
