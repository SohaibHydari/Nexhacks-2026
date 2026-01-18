import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';
import { ScrollText } from 'lucide-react';

// ✅ API base for Django endpoints (same pattern as your other screens)
const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api').replace(/\/$/, '');

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --------------------
// Types matching backend
// --------------------
type ApiLogEntry = {
  id: number;
  created_at: string;     // ISO string
  unit_id: number;
  from_status: string;    // e.g. "AVAILABLE"
  to_status: string;      // e.g. "ENROUTE"
};

type ApiUnit = {
  id: number;
  name: string;
  unit_type: 'AMB' | 'ENG';
  status: string;
};

// UI row shape expected by DataTable usage below
type UiLogRow = {
  timestamp: string;
  unitId: string;     // display chip like "AMB-2"
  unitName: string;   // "Ambulance 2"
  statusFrom: string; // "Available"
  statusTo: string;   // "Enroute"
};

// Convert DB codes to the exact labels your UI shows
const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  ENROUTE: 'Enroute',
  ON_SCENE: 'On Scene',
  TRANSPORTING: 'Transporting',
};

export const EventLogScreen: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');

  // ✅ DB-backed state
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    setErr(null);

    try {
      const [logRows, unitRows] = await Promise.all([
        api<ApiLogEntry[]>('/logs/?limit=200'),
        api<ApiUnit[]>('/units/'),
      ]);
      setLogs(logRows);
      setUnits(unitRows);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load event log');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh({ silent: false });

    // ✅ light polling so the log updates when EMS/IC changes statuses
    const t = setInterval(() => refresh({ silent: true }).catch(() => {}), 1500);
    return () => clearInterval(t);
  }, [refresh]);

  // quick lookup: unit_id -> unit object
  const unitById = useMemo(() => {
    const m = new Map<number, ApiUnit>();
    units.forEach((u) => m.set(u.id, u));
    return m;
  }, [units]);

  const uiLogs: UiLogRow[] = useMemo(() => {
    return (logs || []).map((le) => {
      const u = unitById.get(le.unit_id);
      return {
        timestamp: le.created_at,
        unitId: u?.name ? u.name.replace(/\s+/g, '-').toUpperCase() : `UNIT-${le.unit_id}`,
        unitName: u?.name ?? `Unit ${le.unit_id}`,
        statusFrom: STATUS_LABEL[le.from_status] ?? le.from_status,
        statusTo: STATUS_LABEL[le.to_status] ?? le.to_status,
      };
    });
  }, [logs, unitById]);

  const columns: Column[] = [
    {
      key: 'timestamp',
      label: 'Time',
      render: (value) => format(new Date(value), 'MMM d, h:mm:ss a'),
    },
    {
      key: 'unitName',
      label: 'Unit',
      render: (value, row: any) => (
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
    if (!q) return uiLogs;

    return uiLogs.filter((log) => {
      return (
        log.unitId.toLowerCase().includes(q) ||
        log.unitName.toLowerCase().includes(q) ||
        log.statusFrom.toLowerCase().includes(q) ||
        log.statusTo.toLowerCase().includes(q)
      );
    });
  }, [searchValue, uiLogs]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          Event Log
        </h1>
        <p className="text-muted-foreground">Unit status audit trail</p>
        {loading && <p className="text-sm text-muted-foreground mt-2">Loading…</p>}
        {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      </div>

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search unit, status..."
          searchValue={searchValue}
          onSearchChange={setSearchValue}
        />

        <DataTable columns={columns} data={filteredLogs} emptyMessage="No unit status events yet" />
      </div>
    </div>
  );
};
