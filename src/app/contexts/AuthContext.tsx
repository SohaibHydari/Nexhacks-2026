import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'IC' | 'EMSFire';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Incident {
  id: string;
  name: string;
  type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Active' | 'Monitoring' | 'Closed';
  startTime: string;
}

interface AuthContextType {
  user: User | null;
  incident: Incident | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithRole: (role: Role) => void;
  logout: () => void;
  selectIncident: (incident: Incident) => void;

  // ✅ ADD THIS
  clearIncident: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const demoUsers: Record<Role, User> = {
  IC: { id: '1', name: 'Commander Sarah Chen', email: 'ic@demo.ics', role: 'IC' },
  EMSFire: { id: '2', name: 'EMS Station', email: 'ems@demo.ics', role: 'EMSFire' },
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);

  const login = async (email: string, password: string) => {
    // Mock login
    const foundUser = Object.values(demoUsers).find((u) => u.email === email);
    if (foundUser) {
      setUser(foundUser);
    } else {
      throw new Error('Invalid credentials');
    }
  };

  const loginWithRole = (role: Role) => {
    setUser(demoUsers[role]);
  };

  const logout = () => {
    setUser(null);
    setIncident(null);
  };

  const selectIncident = (inc: Incident) => {
    setIncident(inc);
  };

  // ✅ ADD THIS
  const clearIncident = () => {
    setIncident(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        incident,
        login,
        loginWithRole,
        logout,
        selectIncident,
        clearIncident, // ✅ ADD THIS
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
