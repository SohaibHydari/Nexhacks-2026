import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';

// keep your existing types for non-EMS view if you want
import { Request as OldRequest, Bulletin } from '@/app/contexts/DataContext';

// --------------------
// API config + helpers
// --------------------
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';

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
// Types matching YOUR Django models
// --------------------
type UnitTypeCode = 'AMB' | 'ENG';
type UnitStatusCode = 'AVAILABLE' | 'ENROUTE' | 'ON_SCENE' | 'TRANSPORTING';

type ApiUnit = {
  id: number;              // Django PK
  name: string;            // "Ambulance 3"
  unit_type: UnitTypeCode; // "AMB"
  status: UnitStatusCode;  // "AVAILABLE"
  last_status_at: string;
  updated_at: string;
};

type ApiResourceRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DENIED'
  | 'PARTIAL'
  | 'COMPLETED';

type ApiResourceRequest = {
  id: number;              // Django PK
  unit_type: UnitTypeCode; // "AMB"
  quantity: number;
  priority: string;
  location: string;
  status: ApiResourceRequestStatus;
  created_at: string;
  updated_at: string;
};

// For dispatch modal
const STATUS_LABEL: Record<UnitStatusCode, string> = {
  AVAILABLE: 'Available',
  ENROUTE: 'Enroute',
  ON_SCENE: 'On Scene',
  TRANSPORTING: 'Transporting',
};

const STATUS_TO_API: Record<string, UnitStatusCode> = {
  'Available': 'AVAILABLE',
  'Enroute to scene': 'ENROUTE',
  'On scene': 'ON_SCENE',
  'Transporting': 'TRANSPORTING',
};

// --------------------

interface FieldHomeScreenProps {
  onNavigateToCreateRequest: () => void;
  onNavigateToBulletins: () => void;
  onViewRequest: (request: OldRequest) => void;
  onViewBulletin: (bulletin: Bulletin) => void;
}

export const FieldHomeScreen: React.FC<FieldHomeScreenProps> = ({
  onNavigateToCreateRequest,
  onNavigateToBulletins,
  onViewRequest,
  onViewBulletin,
}) => {
  const { user } = useAuth();

  // EMS STATION VIEW (renders only for EMSFire role)
  const isEMS = user?.role === 'EMSFire';

  // ---- server-backed state (EMS only)
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [requests, setRequests] = useState<ApiResourceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api<ApiUnit[]>('/units/'),
        api<ApiResourceRequest[]>('/requests/?status=PENDING'),
      ]);
      setUnits(u);
      setRequests(r);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isEMS) return;
    refresh();

    // MVP “live sync”: poll so the other client’s updates show up
    const t = setInterval(() => refresh().catch(() => {}), 1500);
    return () => clearInterval(t);
  }, [isEMS, refresh]);

  const allUnits = useMemo(() => units || [], [units]);


  const unitCounts = useMemo(() => {
    const counts = {
      Available: 0,
      Enroute: 0,
      'On Scene': 0,
      Transporting: 0,
    };

    allUnits.forEach((u) => {
      const label = STATUS_LABEL[u.status];
      if (label === 'Available') counts.Available += 1;
      if (label === 'Enroute') counts.Enroute += 1;
      if (label === 'On Scene') counts['On Scene'] += 1;
      if (label === 'Transporting') counts.Transporting += 1;
    });

    return counts;
  }, [allUnits]);


  const availableAmbulances = useMemo(() => {
    return allUnits.filter((u) => u.status === 'AVAILABLE');
  }, [allUnits]);

  // ---- Respond modal state
  const [respondOpen, setRespondOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<ApiResourceRequest | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [note, setNote] = useState('');

  const openRespond = (req: ApiResourceRequest) => {
    setActiveRequest(req);
    setSelectedUnitIds([]);
    setNote('');
    setRespondOpen(true);
  };

  const toggleSelected = (unitId: number) => {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  };

  const setUnitStatus = async (unitId: number, status: UnitStatusCode) => {
    await api(`/units/${unitId}/status/`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    // refresh to reflect status + log created server-side
    await refresh();
  };

  const dispatchRequest = async () => {
    if (!activeRequest) return;

    await api(`/requests/${activeRequest.id}/dispatch/`, {
      method: 'POST',
      body: JSON.stringify({ unit_ids: selectedUnitIds, note }),
    });

    setRespondOpen(false);
    setActiveRequest(null);
    await refresh();
  };

  // =========================
  // EMS UI (server-backed)
  // =========================
  if (isEMS) {
    return (
      <div className="p-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-semibold mb-1">EMS Station</h1>
          <p className="text-muted-foreground">
            Monitor unit readiness and respond to IC dispatch requests
          </p>
          {loading && <p className="text-sm text-muted-foreground mt-2"></p>}
          {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
        </div>

        {/* Top summary counts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(unitCounts).map(([label, count]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className="text-2xl font-semibold">{count}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Units table */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Units</CardTitle>
                <Badge variant="outline">{allUnits.length} Units</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allUnits.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-medium">{u.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          #{u.id}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {STATUS_LABEL[u.status]}
                        </Badge>

                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Incoming IC Requests */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Incoming IC Requests</CardTitle>
                {requests.length > 0 && <Badge variant="destructive">{requests.length} New</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No incoming ambulance requests.
                  </p>
                ) : (
                  requests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 border rounded-lg hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-sm">REQ #{req.id}</div>
                            <Badge variant="outline" className="text-xs">
                              {req.priority || 'Medium'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Needed: {req.quantity} Ambulance(s) • {req.location || '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Created: {format(new Date(req.created_at), 'MMM d, h:mm a')}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => openRespond(req)}
                          disabled={availableAmbulances.length === 0}
                        >
                          Respond
                        </Button>
                      </div>

                      {availableAmbulances.length === 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          No available ambulances to dispatch.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Respond Modal */}
        {respondOpen && activeRequest && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-lg font-semibold">Respond to REQ #{activeRequest.id}</div>
                  <div className="text-sm text-muted-foreground">
                    Select available ambulances to dispatch
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setRespondOpen(false)}>
                  Close
                </Button>
              </div>

              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Priority:</span>{' '}
                  <b>{activeRequest.priority || 'Medium'}</b>
                </div>

                <div className="border rounded-lg p-3 max-h-56 overflow-auto space-y-2">
                  {availableAmbulances.map((u) => (
                    <label key={u.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedUnitIds.includes(u.id)}
                          onChange={() => toggleSelected(u.id)}
                        />
                        <span className="text-sm">{u.name}</span>
                        <Badge variant="secondary" className="text-xs">#{u.id}</Badge>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABEL[u.status]}
                      </Badge>
                    </label>
                  ))}
                </div>

                <div>
                  <div className="text-sm font-medium mb-1">Note (optional)</div>
                  <textarea
                    className="w-full border rounded-lg p-2 text-sm"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., 2 units dispatched now, 1 delayed 10 min"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setRespondOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={dispatchRequest} disabled={selectedUnitIds.length === 0}>
                    Dispatch {selectedUnitIds.length} Unit(s)
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================
  // Non-EMS view: keep your existing hardcoded DataContext flow for now
  // =========================
  // ... leave your current non-EMS logic unchanged
  return <div className="p-6">Non-EMS view (unchanged for MVP)</div>;
};
