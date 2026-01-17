import React, { useState } from 'react';
import { useData } from '@/app/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { ClipboardList, FileDown } from 'lucide-react';
import { toast } from 'sonner';

export const PlanningScreen: React.FC = () => {
  const { requests, hospitalUpdates } = useData();
  const [iapNotes, setIapNotes] = useState('');

  const openRequests = requests.filter(r => 
    r.status !== 'Fulfilled' && r.status !== 'Closed' && r.status !== 'Rejected'
  );

  const criticalHospitals = hospitalUpdates.filter(h => 
    h.diversionStatus || h.icuDiversionStatus
  );

  const requestColumns: Column[] = [
    { key: 'id', label: 'ID' },
    { 
      key: 'priority', 
      label: 'Priority',
      render: (value) => <Badge variant={value === 'Critical' ? 'destructive' : 'default'}>{value}</Badge>
    },
    { key: 'requesterOrg', label: 'Org' },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => <StatusPill status={value} />
    },
  ];

  const hospitalColumns: Column[] = [
    { key: 'hospitalName', label: 'Hospital' },
    { key: 'bedsAvailable', label: 'Beds' },
    { key: 'icuAvailable', label: 'ICU' },
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

  const handleExport = () => {
    toast.success('Planning snapshot exported');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          Planning Board
        </h1>
        <p className="text-muted-foreground">
          Situational awareness and IAP documentation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Open Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{openRequests.length}</p>
            <p className="text-sm text-muted-foreground">
              {openRequests.filter(r => r.priority === 'Critical').length} Critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fulfillment Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {requests.filter(r => r.status === 'Approved').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Critical Hospitals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-orange-600">{criticalHospitals.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Open Requests by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={requestColumns}
                data={openRequests.slice(0, 10)}
                emptyMessage="No open requests"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hospital Status</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={hospitalColumns}
                data={hospitalUpdates.slice(0, 5)}
                emptyMessage="No hospital updates"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>IAP Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Incident Action Plan notes and strategic considerations..."
              value={iapNotes}
              onChange={(e) => setIapNotes(e.target.value)}
              rows={15}
            />
            <Button onClick={handleExport} className="w-full">
              <FileDown className="h-4 w-4 mr-2" />
              Export Planning Snapshot
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
