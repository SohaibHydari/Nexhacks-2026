import React, { useMemo, useState } from 'react';
import { useData } from '@/app/contexts/DataContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';
import { ScrollText } from 'lucide-react';

export const EventLogScreen: React.FC = () => {
  const { unitEventLogs } = useData();
  const [searchValue, setSearchValue] = useState('');

  const columns: Column[] = [
    {
      key: 'timestamp',
      label: 'Time',
      render: (value) => format(new Date(value), 'MMM d, h:mm:ss a'),
    },
    {
      key: 'unitName',
      label: 'Unit',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{value}</span>
          <Badge variant="secondary" className="text-xs">
            {row.unitId}
          </Badge>
        </div>
      ),
    },
    {
      key: 'statusFrom',
      label: 'Status From',
      render: (value) => <Badge variant="outline">{value}</Badge>,
    },
    {
      key: 'statusTo',
      label: 'Status To',
      render: (value) => <Badge variant="secondary">{value}</Badge>,
    },
  ];

  const filteredLogs = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return unitEventLogs;

    return unitEventLogs.filter((log) => {
      return (
        log.unitId.toLowerCase().includes(q) ||
        log.unitName.toLowerCase().includes(q) ||
        log.statusFrom.toLowerCase().includes(q) ||
        log.statusTo.toLowerCase().includes(q)
      );
    });
  }, [searchValue, unitEventLogs]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          Event Log
        </h1>
        <p className="text-muted-foreground">
          Unit status audit trail (mock data for now)
        </p>
      </div>

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search unit, status..."
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />

        <DataTable
          columns={columns}
          data={filteredLogs}
          emptyMessage="No unit status events yet"
        />
      </div>
    </div>
  );
};
