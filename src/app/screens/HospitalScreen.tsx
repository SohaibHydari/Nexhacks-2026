import React, { useState } from 'react';
import { useData, HospitalUpdate } from '@/app/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import { Switch } from '@/app/components/ui/switch';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Building2 } from 'lucide-react';

export const HospitalScreen: React.FC = () => {
  const { hospitalUpdates, addHospitalUpdate } = useData();
  
  const [hospitalName, setHospitalName] = useState('Central Regional Medical Center');
  const [bedsAvailable, setBedsAvailable] = useState('');
  const [icuAvailable, setIcuAvailable] = useState('');
  const [bloodUnits, setBloodUnits] = useState('');
  const [diversionStatus, setDiversionStatus] = useState(false);
  const [icuDiversionStatus, setIcuDiversionStatus] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!bedsAvailable || !icuAvailable || !bloodUnits) {
      toast.error('Please complete all capacity fields');
      return;
    }

    addHospitalUpdate({
      hospitalName,
      bedsAvailable: parseInt(bedsAvailable),
      icuAvailable: parseInt(icuAvailable),
      bloodUnits: parseInt(bloodUnits),
      diversionStatus,
      icuDiversionStatus,
      notes: notes.trim() || 'No additional notes',
    });

    toast.success('Hospital update posted');
    
    // Reset form
    setBedsAvailable('');
    setIcuAvailable('');
    setBloodUnits('');
    setNotes('');
  };

  const columns: Column[] = [
    { 
      key: 'timestamp', 
      label: 'Time',
      render: (value) => format(new Date(value), 'MMM d, h:mm a')
    },
    { key: 'bedsAvailable', label: 'Beds' },
    { key: 'icuAvailable', label: 'ICU' },
    { key: 'bloodUnits', label: 'Blood Units' },
    { 
      key: 'diversionStatus', 
      label: 'Status',
      render: (value, row) => {
        if (row.diversionStatus) return <StatusPill status="Diversion" />;
        if (row.icuDiversionStatus) return <StatusPill status="ICU Full" />;
        return <StatusPill status="Available" />;
      }
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Hospital Updates
        </h1>
        <p className="text-muted-foreground">
          Post capacity and status updates for incident command
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Post Update Form */}
        <Card>
          <CardHeader>
            <CardTitle>Post Status Update</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hospitalName">Hospital Name</Label>
                <Input
                  id="hospitalName"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="beds">Beds Available *</Label>
                  <Input
                    id="beds"
                    type="number"
                    min="0"
                    value={bedsAvailable}
                    onChange={(e) => setBedsAvailable(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icu">ICU Available *</Label>
                  <Input
                    id="icu"
                    type="number"
                    min="0"
                    value={icuAvailable}
                    onChange={(e) => setIcuAvailable(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blood">Blood Units *</Label>
                  <Input
                    id="blood"
                    type="number"
                    min="0"
                    value={bloodUnits}
                    onChange={(e) => setBloodUnits(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label htmlFor="diversion" className="cursor-pointer">General Diversion</Label>
                    <p className="text-sm text-muted-foreground">On full diversion status</p>
                  </div>
                  <Switch
                    id="diversion"
                    checked={diversionStatus}
                    onCheckedChange={setDiversionStatus}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label htmlFor="icuDiversion" className="cursor-pointer">ICU Diversion</Label>
                    <p className="text-sm text-muted-foreground">ICU at capacity</p>
                  </div>
                  <Switch
                    id="icuDiversion"
                    checked={icuDiversionStatus}
                    onCheckedChange={setIcuDiversionStatus}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional information for field units..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">
                Post Update
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Past Updates */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={hospitalUpdates.slice(0, 10)}
              emptyMessage="No updates yet"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
