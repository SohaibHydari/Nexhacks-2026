import React, { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { format } from 'date-fns';

interface IncidentSelectScreenProps {
  onSelect: () => void;
}

const mockIncidents = [
  {
    id: 'INC-001',
    name: 'Wildfire - Cedar Ridge',
    type: 'Wildfire',
    severity: 'Critical',
    status: 'Active',
    startTime: '2026-01-17T06:00:00',
  },
  {
    id: 'INC-002',
    name: 'Mass Casualty - Highway 101',
    type: 'MCI',
    severity: 'High',
    status: 'Active',
    startTime: '2026-01-17T09:30:00',
  },
  {
    id: 'INC-003',
    name: 'Flood Response - Downtown',
    type: 'Flood',
    severity: 'Medium',
    status: 'Monitoring',
    startTime: '2026-01-16T14:00:00',
  },
];

export const IncidentSelectScreen: React.FC<IncidentSelectScreenProps> = ({ onSelect }) => {
  const { selectIncident } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const columns: Column[] = [
    { key: 'name', label: 'Incident Name' },
    { key: 'type', label: 'Type' },
    { 
      key: 'severity', 
      label: 'Severity',
      render: (value) => (
        <span className={`font-medium ${
          value === 'Critical' ? 'text-red-600' :
          value === 'High' ? 'text-orange-600' :
          value === 'Medium' ? 'text-yellow-600' :
          'text-green-600'
        }`}>
          {value}
        </span>
      )
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (value) => <StatusPill status={value} />
    },
    { 
      key: 'startTime', 
      label: 'Start Time',
      render: (value) => format(new Date(value), 'MMM d, h:mm a')
    },
  ];

  const handleRowClick = (incident: any) => {
    selectIncident(incident);
    onSelect();
  };

  const filteredIncidents = mockIncidents.filter(inc => {
    const matchesSearch = inc.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Select Incident</h1>
          <p className="text-muted-foreground">
            Choose an incident to access the resource management system
          </p>
        </div>

        <div className="space-y-4">
          <FilterBar
            searchPlaceholder="Search incidents..."
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            filters={[
              {
                id: 'status',
                label: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: 'all', label: 'All Statuses' },
                  { value: 'Active', label: 'Active' },
                  { value: 'Monitoring', label: 'Monitoring' },
                  { value: 'Closed', label: 'Closed' },
                ],
              },
            ]}
          />

          <DataTable
            columns={columns}
            data={filteredIncidents}
            onRowClick={handleRowClick}
            emptyMessage="No incidents found"
          />
        </div>
      </div>
    </div>
  );
};
