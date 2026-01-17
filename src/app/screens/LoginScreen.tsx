import React, { useState } from 'react';
import { Role, useAuth } from '@/app/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { loginWithRole } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role | ''>('');

  const handleDemoLogin = () => {
    if (selectedRole) {
      loginWithRole(selectedRole as Role);
      onLogin();
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">ICS Resource Manager</CardTitle>
          <CardDescription>Sign in to manage incident resources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleDemoLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@agency.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
            <div className="space-y-3">
              <Label>Select Role</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IC">Incident Commander (IC)</SelectItem>
                  <SelectItem value="EMSFire">EMS/Fire Personnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
