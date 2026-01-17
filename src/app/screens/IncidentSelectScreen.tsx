import React, { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useData } from '@/app/contexts/DataContext';
import { Button } from '@/app/components/ui/button';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { format } from 'date-fns';

interface IncidentSelectScreenProps {
  onSelect: () => void;
}

export const IncidentSelectScreen: React.FC<IncidentSelectScreenProps> = ({ onSelect }) => {
  const { selectIncident } = useAuth();
  const { incidents, addIncident } = useData();

  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create incident modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newIncident, setNewIncident] = useState({
    name: '',
    type: 'Wildfire',
    severity: 'Medium',
    status: 'Active',
  });

  const columns: Column[] = [
    { key: 'name', label: 'Incident Name' },
    { key: 'type', label: 'Type' },
    {
      key: 'severity',
      label: 'Severity',
      render: (value) => (
        <span
          className={`font-medium ${
            value === 'Critical'
              ? 'text-red-600'
              : value === 'High'
              ? 'text-orange-600'
              : value === 'Medium'
              ? 'text-yellow-600'
              : 'text-green-600'
          }`}
        >
          {value}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => <StatusPill status={value} />,
    },
    {
      key: 'startTime',
      label: 'Start Time',
      render: (value) => format(new Date(value), 'MMM d, h:mm a'),
    },
  ];

  const handleRowClick = (incident: any) => {
    selectIncident(incident);
    onSelect();
  };

  const filteredIncidents = incidents.filter((inc: any) => {
    const matchesSearch = inc.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateIncident = () => {
    if (!newIncident.name.trim()) return;

    addIncident({
      name: newIncident.name.trim(),
      type: newIncident.type,
      severity: newIncident.severity as any,
      status: newIncident.status as any,
    });

    // reset + close
    setNewIncident({ name: '', type: 'Wildfire', severity: 'Medium', status: 'Active' });
    setCreateOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header + Add Incident button */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Select Incident</h1>
            <p className="text-muted-foreground">
              Choose an incident to access the resource management system
            </p>
          </div>

          <Button onClick={() => setCreateOpen(true)}>+ Add Incident</Button>
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

      {/* Create Incident Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-lg font-semibold">Create Incident</div>
                <div className="text-sm text-muted-foreground">
                  Add a new incident for IC + EMS/Fire
                </div>
              </div>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1">Incident Name</div>
                <input
                  className="w-full border rounded-lg p-2 text-sm"
                  value={newIncident.name}
                  onChange={(e) => setNewIncident((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Wildfire - Cedar Ridge"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-sm font-medium mb-1">Type</div>
                  <select
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newIncident.type}
                    onChange={(e) => setNewIncident((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    <option>Wildfire</option>
                    <option>MCI</option>
                    <option>Flood</option>
                    <option>Hazmat</option>
                    <option>Storm</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <div className="text-sm font-medium mb-1">Severity</div>
                  <select
                    className="w-full border rounded-lg p-2 text-sm"
                    value={newIncident.severity}
                    onChange={(e) =>
                      setNewIncident((prev) => ({ ...prev, severity: e.target.value }))
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Status</div>
                <select
                  className="w-full border rounded-lg p-2 text-sm"
                  value={newIncident.status}
                  onChange={(e) => setNewIncident((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option>Active</option>
                  <option>Monitoring</option>
                  <option>Closed</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateIncident} disabled={!newIncident.name.trim()}>
                  Create
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
