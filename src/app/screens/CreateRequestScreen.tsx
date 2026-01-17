import React, { useState } from 'react';
import { useData, ResourceLine, Priority } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CreateRequestScreenProps {
  onSuccess: () => void;
}

export const CreateRequestScreen: React.FC<CreateRequestScreenProps> = ({ onSuccess }) => {
  const { user, incident } = useAuth();
  const { addRequest } = useData();
  
  const [priority, setPriority] = useState<Priority>('Medium');
  const [neededBy, setNeededBy] = useState('');
  const [location, setLocation] = useState('');
  const [justification, setJustification] = useState('');
  const [patientImpact, setPatientImpact] = useState('');
  const [resources, setResources] = useState<Partial<ResourceLine>[]>([
    { resourceType: '', qtyRequested: 1 }
  ]);

  const resourceTypes = [
    'Ambulances',
    'Paramedics',
    'Medical Supplies - Trauma',
    'IV Fluids',
    'Bandages',
    'Fire Engines',
    'Firefighters',
    'Water Tenders',
    'Oxygen Tanks',
    'Personal Protective Equipment',
  ];

  const addResourceLine = () => {
    setResources([...resources, { resourceType: '', qtyRequested: 1 }]);
  };

  const removeResourceLine = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const updateResourceLine = (index: number, field: keyof ResourceLine, value: any) => {
    const updated = [...resources];
    updated[index] = { ...updated[index], [field]: value };
    setResources(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!neededBy) {
      toast.error('Please specify when resources are needed');
      return;
    }
    if (!location.trim()) {
      toast.error('Please specify location');
      return;
    }
    if (!justification.trim()) {
      toast.error('Please provide justification');
      return;
    }
    if (resources.length === 0 || !resources[0].resourceType) {
      toast.error('Please add at least one resource');
      return;
    }
    if (resources.some(r => !r.resourceType || !r.qtyRequested || r.qtyRequested < 1)) {
      toast.error('Please complete all resource fields');
      return;
    }

    const newRequest = {
      incidentId: incident?.id || '',
      requesterId: user?.id || '',
      requesterName: user?.name || '',
      requesterOrg: user?.role === 'EMS' ? 'EMS Station 12' : 'Fire Station 7',
      priority,
      status: 'Submitted' as const,
      neededBy,
      location,
      justification,
      patientImpact: patientImpact.trim() || undefined,
      resources: resources.map((r, i) => ({
        id: `RL-${Date.now()}-${i}`,
        resourceType: r.resourceType!,
        qtyRequested: r.qtyRequested!,
      })),
    };

    addRequest(newRequest);
    toast.success('Request submitted successfully');
    onSuccess();
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">Create Resource Request</h1>
          <p className="text-muted-foreground">
            Request resources for incident operations
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neededBy">Needed By *</Label>
                  <Input
                    id="neededBy"
                    type="datetime-local"
                    value={neededBy}
                    onChange={(e) => setNeededBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  placeholder="e.g., Sector Alpha, Grid 23-B"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification *</Label>
                <Textarea
                  id="justification"
                  placeholder="Explain why these resources are needed..."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientImpact">Patient Impact (optional)</Label>
                <Textarea
                  id="patientImpact"
                  placeholder="Describe impact on patients if not fulfilled..."
                  value={patientImpact}
                  onChange={(e) => setPatientImpact(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Resources</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addResourceLine}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {resources.map((resource, index) => (
                <div key={index} className="flex gap-3 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Resource Type *</Label>
                    <Select
                      value={resource.resourceType}
                      onValueChange={(v) => updateResourceLine(index, 'resourceType', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select resource..." />
                      </SelectTrigger>
                      <SelectContent>
                        {resourceTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-32 space-y-2">
                    <Label>Quantity *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={resource.qtyRequested}
                      onChange={(e) => updateResourceLine(index, 'qtyRequested', parseInt(e.target.value) || 1)}
                    />
                  </div>

                  {resources.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeResourceLine(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onSuccess}>
              Cancel
            </Button>
            <Button type="submit">
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
