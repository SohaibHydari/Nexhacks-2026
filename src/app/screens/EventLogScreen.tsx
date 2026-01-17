import React, { useState } from 'react';
import { useData } from '@/app/contexts/DataContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';
import { ScrollText } from 'lucide-react';

export const EventLogScreen: React.FC = () => {
  const { eventLogs } = useData();
  const [searchValue, setSearchValue] = useState('');

  const columns: Column[] = [
    { 
      key: 'timestamp', 
      label: 'Timestamp',
      render: (value) => format(new Date(value), 'MMM d, yyyy h:mm:ss a')
    },
    { 
      key: 'actor', 
      label: 'Actor',
      render: (value) => <Badge variant="secondary">{value}</Badge>
    },
    { key: 'action', label: 'Action' },
    { 
      key: 'entityType', 
      label: 'Entity',
      render: (value, row) => `${value} (${row.entityId})`
    },
  ];

  const filteredLogs = eventLogs.filter(log =>
    log.actor.toLowerCase().includes(searchValue.toLowerCase()) ||
    log.action.toLowerCase().includes(searchValue.toLowerCase()) ||
    log.entityId.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          Event Log
        </h1>
        <p className="text-muted-foreground">
          Immutable audit trail of all system actions
        </p>
      </div>

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search events..."
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />

        <DataTable
          columns={columns}
          data={filteredLogs}
          emptyMessage="No events logged"
        />
      </div>
    </div>
  );
};
