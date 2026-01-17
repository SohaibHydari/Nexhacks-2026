import React, { useState } from 'react';
import { useData } from '@/app/contexts/DataContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { format } from 'date-fns';
import { AlertCircle, TrendingUp, Building2, Bell } from 'lucide-react';
import { RequestDetailDrawer } from './RequestDetailDrawer';
import { HospitalUpdateDrawer } from './HospitalUpdateDrawer';
import { Request, HospitalUpdate } from '@/app/contexts/DataContext';

export const ICDashboard: React.FC = () => {
  const {requests, hospitalUpdates, initialPredictions} = useData();
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [selectedHospitalUpdate, setSelectedHospitalUpdate] = useState<HospitalUpdate | null>(null);

  const columns: Column[] = [
    { 
      key: 'priority', 
      label: 'Priority',
      render: (value) => (
        <Badge variant={
          value === 'Critical' ? 'destructive' :
          value === 'High' ? 'default' :
          'secondary'
        }>
          {value}
        </Badge>
      )
    },
    { 
      key: 'requesterOrg', 
      label: 'Org/Unit'
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => <StatusPill status={value} />
    },
    { 
      key: 'neededBy', 
      label: 'Needed By',
      render: (value) => format(new Date(value), 'MMM d, h:mm a')
    },
    { 
      key: 'varianceFlag', 
      label: 'Variance',
      render: (value) => value ? (
        <Badge variant={
          value === 'Critical' ? 'destructive' :
          value === 'Warning' ? 'default' :
          'secondary'
        }>
          {value}
        </Badge>
      ) : null
    },
  ];

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.requesterOrg.toLowerCase().includes(searchValue.toLowerCase()) ||
                         req.id.toLowerCase().includes(searchValue.toLowerCase());
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Top outliers for prediction summary
  const outlierRequests = requests
    .filter(r => r.varianceFlag && r.varianceFlag !== 'OK')
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Operations Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and triage resource requests across the incident
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Request Queue */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FilterBar
                searchPlaceholder="Search requests..."
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                filters={[
                  {
                    id: 'status',
                    label: 'Status',
                    value: statusFilter,
                    onChange: setStatusFilter,
                    options: [
                      { value: 'all', label: 'All' },
                      { value: 'Submitted', label: 'Submitted' },
                      { value: 'Under Review', label: 'Under Review' },
                      { value: 'Counteroffered', label: 'Counteroffered' },
                      { value: 'Approved', label: 'Approved' },
                    ],
                  },
                  {
                    id: 'priority',
                    label: 'Priority',
                    value: priorityFilter,
                    onChange: setPriorityFilter,
                    options: [
                      { value: 'all', label: 'All' },
                      { value: 'Critical', label: 'Critical' },
                      { value: 'High', label: 'High' },
                      { value: 'Medium', label: 'Medium' },
                      { value: 'Low', label: 'Low' },
                    ],
                  },
                ]}
              />
              <DataTable
                columns={columns}
                data={filteredRequests}
                onRowClick={setSelectedRequest}
                emptyMessage="No requests in queue"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Predictions & Hospital Feed */}
        <div className="space-y-4">
          {/* Prediction Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Prediction Outliers
              </CardTitle>
            </CardHeader>
            <CardContent>
              {outlierRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outliers detected</p>
              ) : (
                <div className="space-y-3">
                  {outlierRequests.map((req) => (
                    <div 
                      key={req.id}
                      className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{req.id}</p>
                          <p className="text-xs text-muted-foreground">{req.requesterOrg}</p>
                        </div>
                        <Badge variant={req.varianceFlag === 'Critical' ? 'destructive' : 'default'} className="text-xs">
                          {req.varianceFlag}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hospital Updates Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Hospital Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hospitalUpdates.slice(0, 5).map((update) => (
                  <div 
                    key={update.id}
                    className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => setSelectedHospitalUpdate(update)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="font-medium text-sm">{update.hospitalName}</p>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(update.timestamp), 'h:mm a')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {update.diversionStatus && (
                          <StatusPill status="Diversion" />
                        )}
                        {update.icuDiversionStatus && (
                          <StatusPill status="ICU Full" />
                        )}
                        {!update.diversionStatus && !update.icuDiversionStatus && (
                          <StatusPill status="Available" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Bulletin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Recent Bulletins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Create Bulletin
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Request Detail Drawer */}
      {selectedRequest && (
        <RequestDetailDrawer
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />
      )}

      {/* Hospital Update Drawer */}
      {selectedHospitalUpdate && (
        <HospitalUpdateDrawer
          update={selectedHospitalUpdate}
          onClose={() => setSelectedHospitalUpdate(null)}
        />
      )}
    </div>
  );
};
