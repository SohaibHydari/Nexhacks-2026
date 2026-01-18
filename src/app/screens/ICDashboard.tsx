import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useData, Request } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';

import {  Bell, AlertTriangle, RotateCcw} from 'lucide-react';
import { RequestDetailDrawer } from './RequestDetailDrawer';

const _env = ((import.meta as unknown) as { env: Record<string, string | undefined> }).env;
const PREDICTION_API_BASE = (_env.VITE_API_BASE ?? '').replace(/\/$/, '');

// ✅ API base for Django endpoints
// Your .env is: VITE_API_BASE=http://localhost:8000/api
// So API_BASE should be http://localhost:8000/api
const API_BASE = (_env.VITE_API_BASE ?? 'http://localhost:8000/api').replace(/\/$/, '');

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

const PREDICTION_SUBCATEGORIES: Record<string, string[]> = {
  Fire: [
    'Structure Fire',
    'Brush Fire',
    'Warehouse Fire',
    'Industrial Fire',
    'High-Rise Fire',
    'Hazmat Fire',
    'Vehicle Fire',
    'Wildland Fire',
  ],
  'Public Health': ['Disease Outbreak', 'Heat Illness Surge', 'Hospital Surge', 'Mass Casualty'],
  Weather: [
    'Ice Storm',
    'Heatwave',
    'Severe Thunderstorm',
    'Tropical Storm',
    'Tornado',
    'Flash Flood',
    'Blizzard',
    'River Flood',
    'Extreme Cold',
    'Hurricane',
  ],
  Infrastructure: ['Water Main Break', 'Bridge Collapse', 'Cyber Outage', 'Damaged Gas Line', 'Power Outage'],
};

// --------------------
// DB types (Django)
// --------------------
type UnitTypeCode = 'AMB' | 'ENG';
type UnitStatusCode = 'AVAILABLE' | 'ENROUTE' | 'ON_SCENE' | 'TRANSPORTING';

type ApiUnit = {
  id: number;              // Django PK
  name: string;            // "Ambulance 3"
  unit_type: UnitTypeCode; // "AMB"
  status: UnitStatusCode;  // "AVAILABLE"
};

type UiUnitStatus = 'Transporting' | 'In Transit' | 'On Scene';
type UiUnitType = 'Fire Engine' | 'Ambulance';

type UiUnitRow = {
  id: string; // ENG-3 / AMB-2 style for the UI table
  unitType: UiUnitType;
  status: UiUnitStatus;
  assignedTo?: string;
  depleted?: boolean;

  // keep original DB reference if you ever need it
  _dbId: number;
  _dbStatus: UnitStatusCode;
  _dbType: UnitTypeCode;
  _dbName: string;
};

function dbUnitToUiRow(u: ApiUnit): UiUnitRow {
  const uiType: UiUnitType = u.unit_type === 'ENG' ? 'Fire Engine' : 'Ambulance';

  const uiId =
    u.unit_type === 'ENG'
      ? `ENG-${u.id}`
      : `AMB-${u.id}`;

  const uiStatus: UiUnitStatus =
    u.status === 'ON_SCENE'
      ? 'On Scene'
      : u.status === 'TRANSPORTING'
        ? 'Transporting'
        : 'In Transit'; // ENROUTE (and even AVAILABLE) should not show in this IC table

  return {
    id: uiId,
    unitType: uiType,
    status: uiStatus,
    _dbId: u.id,
    _dbStatus: u.status,
    _dbType: u.unit_type,
    _dbName: u.name,
  };
}

export const ICDashboard: React.FC = () => {
  const { requests, addRequest, logEvent } = useData();
  const { user, incident } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // --------------------
  // ✅ Units come from DB now (not hardcoded)
  // --------------------
  const [dbUnits, setDbUnits] = useState<ApiUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsErr, setUnitsErr] = useState<string | null>(null);

  const refreshUnits = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;

    // Only show loading spinner/disable on the first load (not on polling)
    if (!silent) setUnitsLoading(true);

    try {
      const u = await api<ApiUnit[]>('/units/');
      setDbUnits(u);
      setUnitsErr(null);
    } catch (e: any) {
      setUnitsErr(e?.message ?? 'Failed to load units');
    } finally {
      if (!silent) setUnitsLoading(false);
    }
  }, []);


  useEffect(() => {
    // initial load (not silent)
    refreshUnits({ silent: false });

    // polling (silent)
    const t = setInterval(() => refreshUnits({ silent: true }).catch(() => {}), 1500);
    return () => clearInterval(t);
  }, [refreshUnits]);
  


  // Only show ENROUTE + ON_SCENE + TRANSPORTING in the IC table
  const units: UiUnitRow[] = useMemo(() => {
  const relevant = dbUnits.filter((u) => u.status === 'ENROUTE' || u.status === 'ON_SCENE');
    return relevant.map(dbUnitToUiRow);
  }, [dbUnits]);

  // --------------------
  // Prediction modal state & inputs
  // --------------------
  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [predictionInput, setPredictionInput] = useState({
    location: '',
    buildings: 0,
    patientCount: 0,
    disasterType: 'Fire',
    subCategory: PREDICTION_SUBCATEGORIES['Fire'][0],
  });

  const [predicted, setPredicted] = useState<{ engines: number; ambulances: number } | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  // Submit request manual inputs
  const [reqEngines, setReqEngines] = useState(0);
  const [reqAmbulances, setReqAmbulances] = useState(0);

  // ✅ manual request fields
  const [reqLocation, setReqLocation] = useState('');
  const [reqPriority, setReqPriority] = useState<'Low' | 'Medium' | 'High'>('High');
  // --------------------
// Low Dispatch Alert
// --------------------
const [lowDispatch, setLowDispatch] = useState<{ low: boolean; warning: string } | null>(null);
const [lowDispatchLoading, setLowDispatchLoading] = useState(false);
const [lowDispatchError, setLowDispatchError] = useState<string | null>(null);

const fetchLowDispatchAlert = useCallback(async () => {
  setLowDispatchLoading(true);
  setLowDispatchError(null);

  try {
    const res = await fetch(`${API_BASE}/monitor/ambulances/low/`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) throw new Error(`Low dispatch check failed (${res.status})`);

    const data = await res.json();
    setLowDispatch({
      low: Boolean(data.low_ambulances),
      warning: String(data.warning ?? ''),
    });
  } catch (e) {
    setLowDispatch(null);
    setLowDispatchError(e instanceof Error ? e.message : 'Failed to load low dispatch alert.');
  } finally {
    setLowDispatchLoading(false);
  }
}, []);

  
  useEffect(() => {
  fetchLowDispatchAlert();
  const id = window.setInterval(fetchLowDispatchAlert, 30000); // every 30s
  return () => window.clearInterval(id);
  }, [fetchLowDispatchAlert]);

  // Units table columns (reuse DataTable)
  const unitColumns: Column[] = [
    { key: 'id', label: 'Unit ID' },
    { key: 'unitType', label: 'Type' },
    { key: 'status', label: 'Status', render: (v: any) => <StatusPill status={v as any} /> },
    { key: 'assignedTo', label: 'Assigned' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: UiUnitRow) => (
        <div className="flex gap-2">
          {row.status === 'In Transit' && (
            <Button size="sm" onClick={() => handleMarkOnScene(row._dbId)}>
              Mark On Scene
            </Button>
          )}
          {row.status === 'On Scene' && (
            <Button size="sm" variant="destructive" onClick={() => handleTransporting(row._dbId)}>
              Transporting
            </Button>
          )}
        </div>
      ),
    },
  ];

  // ✅ IC status updates now update DB
  const handleMarkOnScene = async (dbUnitId: number) => {
    try {
      await api(`/units/${dbUnitId}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ON_SCENE' }),
      });
      await refreshUnits();

      logEvent({
        actor: user?.name || 'IC',
        action: 'Unit On Scene',
        entityType: 'Unit',
        entityId: String(dbUnitId),
        payload: { to_status: 'ON_SCENE' },
      });
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update unit status');
    }
  };

  const handleTransporting = async (dbUnitId: number) => {
    try {
      await api(`/units/${dbUnitId}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'TRANSPORTING' }),
      });
      await refreshUnits();

      logEvent({
        actor: user?.name || 'IC',
        action: 'Unit Transporting',
        entityType: 'Unit',
        entityId: String(dbUnitId),
        payload: { to_status: 'TRANSPORTING' },
      });
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update unit status');
    }
  };

  const runPrediction = async () => {
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const incidentPayload = {
        incident_category: predictionInput.disasterType,
        incident_subtype: predictionInput.subCategory,
        city: predictionInput.location,
        state: '',
        population_affected_est: predictionInput.patientCount,
        injuries_est: predictionInput.patientCount,
        structures_threatened: predictionInput.buildings,
        structures_damaged: predictionInput.buildings,
        start_time: new Date().toISOString(),
      };

      const response = await fetch(`${PREDICTION_API_BASE}/api/initial-prediction/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident: incidentPayload }),
      });

      if (!response.ok) throw new Error('Prediction request failed.');

      const data = await response.json();
      const engines = Math.max(0, Math.round(data.prediction?.firetrucks_dispatched_engines ?? 0));
      const ambulances = Math.max(0, Math.round(data.prediction?.ambulances_dispatched ?? 0));
      setPredicted({ engines, ambulances });

      // carry predicted location into manual field if empty
      if (!reqLocation.trim() && predictionInput.location.trim()) {
        setReqLocation(predictionInput.location.trim());
      }
    } catch (error) {
      setPredicted(null);
      setPredictionError(error instanceof Error ? error.message : 'Unable to run prediction.');
    } finally {
      setPredictionLoading(false);
    }
  };

  // ✅ Create real DB rows so EMS can see them
  const submitToDatabase = async (engines: number, ambulances: number) => {
    const calls: Promise<any>[] = [];

    const location = reqLocation.trim() || predictionInput.location?.trim() || 'Unknown';
    const priority = reqPriority || 'Medium';

    if (ambulances > 0) {
      calls.push(
        api('/requests/create/', {
          method: 'POST',
          body: JSON.stringify({
            unit_type: 'AMB',
            quantity: ambulances,
            priority,
            location,
          }),
        })
      );
    }

    if (engines > 0) {
      calls.push(
        api('/requests/create/', {
          method: 'POST',
          body: JSON.stringify({
            unit_type: 'ENG',
            quantity: engines,
            priority,
            location,
          }),
        })
      );
    }

    if (calls.length === 0) return;
    await Promise.all(calls);
  };

  const handleSubmitRequest = async (fromPrediction = false) => {
    if (!incident || !user) return;

    const engines = fromPrediction && predicted ? predicted.engines : reqEngines;
    const ambulances = fromPrediction && predicted ? predicted.ambulances : reqAmbulances;

    const finalLocation = reqLocation.trim() || predictionInput.location?.trim() || 'Unknown';
    const finalPriority = reqPriority || 'Medium';

    try {
      await submitToDatabase(engines, ambulances);

      // Optional: keep local DataContext for your UI/outliers demo
      const resources = [] as any[];
      if (ambulances > 0)
        resources.push({ id: `RL-A-${Date.now()}`, resourceType: 'Ambulances', qtyRequested: ambulances });
      if (engines > 0)
        resources.push({ id: `RL-E-${Date.now()}`, resourceType: 'Fire Engines', qtyRequested: engines });

      addRequest({
        incidentId: incident.id,
        requesterId: user.id,
        requesterName: user.name,
        requesterOrg: user.role,
        priority: finalPriority,
        status: 'Submitted',
        neededBy: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        location: finalLocation,
        justification: fromPrediction
          ? `Auto-generated: ${predictionInput.disasterType} / ${predictionInput.subCategory}`
          : 'Manual request from IC',
        patientImpact: String(predictionInput.patientCount || ''),
        resources,
      });

      logEvent({
        actor: user.name,
        action: 'Submitted Request (DB)',
        entityType: 'ResourceRequest',
        entityId: 'created',
        payload: { engines, ambulances, location: finalLocation, priority: finalPriority },
      });

      setShowPredictionModal(false);
      setPredicted(null);
      setReqAmbulances(0);
      setReqEngines(0);
      setReqLocation('');
      setReqPriority('High');
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  const populateRequestFromPrediction = () => {
    if (!predicted) return;
    setReqEngines(predicted.engines);
    setReqAmbulances(predicted.ambulances);

    if (predictionInput.location.trim()) setReqLocation(predictionInput.location.trim());

    setShowPredictionModal(false);
    setPredicted(null);
  };

 
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Operations Dashboard</h1>
          <p className="text-muted-foreground">Monitor and triage resource requests across the incident</p>
          {incident && (
            <p className="text-sm text-muted-foreground mt-1">
              Incident: <span className="font-medium">{incident.name}</span>
            </p>
          )}
          {unitsErr && <p className="text-sm text-red-600 mt-2">{unitsErr}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Units — Enroute & On Scene</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-4 items-center">
                  <Badge>{units.filter(u => u.status === 'In Transit').length} Enroute</Badge>
                  <Badge>{units.filter(u => u.status === 'On Scene').length} On Scene</Badge>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowPredictionModal(true)} disabled={false}>
                    Initial Prediction
                  </Button>

                </div>
              </div>

              <DataTable columns={unitColumns} data={units as any[]} emptyMessage="No units enroute/on scene" />

              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-medium">Submit Request</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm block mb-1">Location</label>
                    <input
                      value={reqLocation}
                      onChange={e => setReqLocation(e.target.value)}
                      className="w-full input input-sm"
                      placeholder="e.g., UPMC Presby, 200 Lothrop St"
                    />
                  </div>

                  <div>
                    <label className="text-sm block mb-1">Priority</label>
                    <select
                      value={reqPriority}
                      onChange={e => setReqPriority(e.target.value as any)}
                      className="w-full input input-sm"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <label className="text-sm">Ambulances</label>
                  <input
                    type="number"
                    min={0}
                    value={reqAmbulances}
                    onChange={e => setReqAmbulances(Number(e.target.value))}
                    className="input input-sm w-24"
                  />

                  <label className="text-sm">Fire Engines</label>
                  <input
                    type="number"
                    min={0}
                    value={reqEngines}
                    onChange={e => setReqEngines(Number(e.target.value))}
                    className="input input-sm w-24"
                  />

                  <Button onClick={() => handleSubmitRequest(false)} disabled={reqAmbulances === 0 && reqEngines === 0}>
                    Submit
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Location/priority are written to the DB so EMS sees them.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          

          <Card className={lowDispatch?.low ? "border-destructive/40" : ""}>
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className={lowDispatch?.low ? "h-5 w-5 text-destructive" : "h-5 w-5 text-muted-foreground"} />
        <span className="tracking-tight">Low Dispatch Alert</span>

        {lowDispatch && (
          <Badge variant={lowDispatch.low ? "destructive" : "secondary"} className="ml-2">
            {lowDispatch.low ? "Critical" : "Normal"}
          </Badge>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={fetchLowDispatchAlert}
        disabled={lowDispatchLoading}
        className="gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Refresh
      </Button>
    </CardTitle>
  </CardHeader>

  <CardContent className="space-y-3">
    {lowDispatchLoading && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse" />
        Checking ambulance availability…
      </div>
    )}

    {lowDispatchError && (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {lowDispatchError}
      </div>
    )}

    {!lowDispatchLoading && !lowDispatchError && lowDispatch && (
      <>
        <div className="flex items-center justify-between rounded-lg border bg-background/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${lowDispatch.low ? "bg-destructive" : "bg-muted-foreground"}`} />
            <p className="text-sm font-medium">
              Status:{" "}
              <span className={lowDispatch.low ? "text-destructive" : "text-foreground"}>
                {lowDispatch.low ? "LOW" : "OK"}
              </span>
            </p>
          </div>

          <p className="text-xs text-muted-foreground">Auto-refresh: 30s</p>
        </div>

        <div
          className={`rounded-lg border p-3 text-sm leading-relaxed ${
            lowDispatch.low ? "border-destructive/25 bg-destructive/5" : "border-border bg-muted/30"
          }`}
        >
          <p className="font-medium mb-1">
            {lowDispatch.low ? "Action recommended" : "No action needed"}
          </p>
          <p className="text-muted-foreground whitespace-pre-wrap">{lowDispatch.warning}</p>
        </div>
      </>
    )}

    {!lowDispatchLoading && !lowDispatchError && !lowDispatch && (
      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        No alert data available.
      </div>
    )}
  </CardContent>
</Card>

        </div>
      </div>

      {selectedRequest && <RequestDetailDrawer request={selectedRequest} onClose={() => setSelectedRequest(null)} />}

      {/* Prediction Modal */}
      {showPredictionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white p-6 rounded-lg w-[520px]">
            <h3 className="text-lg font-medium mb-4">Initial Prediction</h3>

            <div className="space-y-2">
              <div>
                <label className="block text-sm">City Location</label>
                <input
                  value={predictionInput.location}
                  onChange={e => setPredictionInput(i => ({ ...i, location: e.target.value }))}
                  className="w-full input"
                />
              </div>

              <div>
                <label className="block text-sm">Buildings Affected</label>
                <input
                  type="number"
                  value={predictionInput.buildings}
                  onChange={e => setPredictionInput(i => ({ ...i, buildings: Number(e.target.value) }))}
                  className="w-full input"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm">Approx. Affected Population</label>
                  <input
                    type="number"
                    value={predictionInput.patientCount}
                    onChange={e => setPredictionInput(i => ({ ...i, patientCount: Number(e.target.value) }))}
                    className="w-full input"
                  />
                </div>

                <div>
                  <label className="block text-sm">Disaster Type</label>
                  <select
                    value={predictionInput.disasterType}
                    onChange={e => {
                      const newType = e.target.value;
                      const options = PREDICTION_SUBCATEGORIES[newType] ?? ['General'];
                      setPredictionInput(i => ({
                        ...i,
                        disasterType: newType,
                        subCategory: options[0],
                      }));
                    }}
                    className="w-full input"
                  >
                    <option value="Fire">Fire</option>
                    <option value="Weather">Weather</option>
                    <option value="Infrastructure">Infrastructure</option>
                    <option value="Public Health">Public Health</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm">Subcategory</label>
                  <select
                    value={predictionInput.subCategory}
                    onChange={e => setPredictionInput(i => ({ ...i, subCategory: e.target.value }))}
                    className="w-full input"
                  >
                    {(PREDICTION_SUBCATEGORIES[predictionInput.disasterType] ?? ['General']).map(sub => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {predictionError && <p className="text-sm text-red-600">{predictionError}</p>}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPredictionModal(false);
                  setPredicted(null);
                  setPredictionError(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={runPrediction} disabled={predictionLoading}>
                {predictionLoading ? 'Running...' : 'Run Prediction'}
              </Button>
            </div>

            {predictionError && <p className="mt-3 text-sm text-destructive">{predictionError}</p>}

            {predicted && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Prediction Results</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Fire Engines</p>
                    <p className="text-2xl font-semibold">{predicted.engines}</p>
                    <p className="text-sm text-muted-foreground">Recommended count</p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Ambulances</p>
                    <p className="text-2xl font-semibold">{predicted.ambulances}</p>
                    <p className="text-sm text-muted-foreground">Recommended count</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <Button onClick={populateRequestFromPrediction}>
                    Create Request from Prediction
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
