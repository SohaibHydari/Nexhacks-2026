import React, { useState } from 'react';
import { useData, Request } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';

import { TrendingUp, Bell } from 'lucide-react';
import { RequestDetailDrawer } from './RequestDetailDrawer';

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



export const ICDashboard: React.FC = () => {
  const { requests, addRequest, logEvent } = useData();
  const { user, incident } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Units state
  type UnitStatus = 'Transporting' | 'In Transit' | 'On Scene';
  interface Unit {
    id: string;
    unitType: 'Fire Engine' | 'Ambulance';
    status: UnitStatus;
    assignedTo?: string;
    depleted?: boolean;
  }

  const [units, setUnits] = useState<Unit[]>([
    { id: 'ENG-1', unitType: 'Fire Engine', status: 'On Scene' },
    { id: 'ENG-2', unitType: 'Fire Engine', status: 'On Scene' },
    { id: 'AMB-1', unitType: 'Ambulance', status: 'In Transit' },
    { id: 'AMB-2', unitType: 'Ambulance', status: 'In Transit' },
  ]);

  // Prediction modal state & inputs
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

  // Units table columns (reuse DataTable)
  const unitColumns: Column[] = [
    { key: 'id', label: 'Unit ID' },
    { key: 'unitType', label: 'Type' },
    { key: 'status', label: 'Status', render: (v: any) => <StatusPill status={v as any} /> },
    { key: 'assignedTo', label: 'Assigned' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: any) => (
        <div className="flex gap-2">
          {row.status === 'In Transit' && (
            <>
              <Button size="sm" onClick={() => handleMarkOnScene(row.id)}>Mark On Scene</Button>
            </>
          )}
          {row.status === 'On Scene' && (
            <Button size="sm" variant="destructive" onClick={() => handleLeftScene(row.id)}>Transporting</Button>
          )}
        </div>
      ),
    },
  ];

  const handleMarkOnScene = (unitId: string) => {
    setUnits(prev => prev.map(u => (u.id === unitId ? { ...u, status: 'On Scene' } : u)));
    logEvent({
      actor: user?.name || 'IC',
      action: 'Unit On Scene',
      entityType: 'Unit',
      entityId: unitId,
      payload: {},
    });
  };

  const handleLeftScene = (unitId: string) => {
    setUnits(prev => prev.filter(u => u.id !== unitId));
    logEvent({
      actor: user?.name || 'IC',
      action: 'Unit Left Scene',
      entityType: 'Unit',
      entityId: unitId,
      payload: {},
    });
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
        start_time: new Date().toISOString(),
      };

      const response = await fetch('/api/initial-prediction/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident: incidentPayload }),
      });

      if (!response.ok) throw new Error('Prediction request failed.');

      const data = await response.json();
      const engines = Math.max(0, Math.round(data.prediction?.firetrucks_dispatched_engines ?? 0));
      const ambulances = Math.max(0, Math.round(data.prediction?.ambulances_dispatched ?? 0));
      setPredicted({ engines, ambulances });
    } catch (error) {
      setPredicted(null);
      setPredictionError(error instanceof Error ? error.message : 'Unable to run prediction.');
    } finally {
      setPredictionLoading(false);
    }
  };

  const handleSubmitRequest = (fromPrediction = false) => {
    if (!incident || !user) return;

    const engines = fromPrediction && predicted ? predicted.engines : reqEngines;
    const ambulances = fromPrediction && predicted ? predicted.ambulances : reqAmbulances;

    const resources = [] as any[];
    if (ambulances > 0) resources.push({ id: `RL-A-${Date.now()}`, resourceType: 'Ambulances', qtyRequested: ambulances });
    if (engines > 0) resources.push({ id: `RL-E-${Date.now()}`, resourceType: 'Fire Engines', qtyRequested: engines });

    addRequest({
      incidentId: incident.id,
      requesterId: user.id,
      requesterName: user.name,
      requesterOrg: user.role,
      priority: 'High',
      status: 'Submitted',
      neededBy: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      location: predictionInput.location || 'Unknown',
      justification: fromPrediction
        ? `Auto-generated: ${predictionInput.disasterType} / ${predictionInput.subCategory}`
        : 'Manual request from IC',
      patientImpact: String(predictionInput.patientCount || ''),
      resources,
    });

    logEvent({
      actor: user.name,
      action: 'Submitted Request',
      entityType: 'Request',
      entityId: 'TBD',
      payload: { engines, ambulances },
    });

    setShowPredictionModal(false);
    setPredicted(null);
    setReqAmbulances(0);
    setReqEngines(0);
  };

  const populateRequestFromPrediction = () => {
    if (!predicted) return;
    setReqEngines(predicted.engines);
    setReqAmbulances(predicted.ambulances);
    setShowPredictionModal(false);
    setPredicted(null);
  };

  const outlierRequests = requests
    .filter((r: Request) => r.varianceFlag && r.varianceFlag !== 'OK')
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* ✅ TOP BAR WITH BACK BUTTON */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Operations Dashboard</h1>
          <p className="text-muted-foreground">Monitor and triage resource requests across the incident</p>
          {incident && (
            <p className="text-sm text-muted-foreground mt-1">
              Incident: <span className="font-medium">{incident.name}</span>
            </p>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Units Table */}
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
                  <Button onClick={() => setShowPredictionModal(true)} disabled={units.length > 0}>
                    Initial Prediction
                  </Button>
                </div>
              </div>

              <DataTable columns={unitColumns} data={units as any[]} emptyMessage="No tracked units" />

              {/* Manual submit panel */}
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Submit Request</h3>
                <div className="flex gap-2 items-center">
                  <label className="text-sm">Ambulances</label>
                  <input
                    type="number"
                    min={0}
                    value={reqAmbulances}
                    onChange={e => setReqAmbulances(Number(e.target.value))}
                    className="input input-sm"
                  />
                  <label className="text-sm">Fire Engines</label>
                  <input
                    type="number"
                    min={0}
                    value={reqEngines}
                    onChange={e => setReqEngines(Number(e.target.value))}
                    className="input input-sm"
                  />
                  <Button onClick={() => handleSubmitRequest(false)} disabled={reqAmbulances === 0 && reqEngines === 0}>
                    Submit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
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
                  {outlierRequests.map((req: Request) => (
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
                        <Badge
                          variant={req.varianceFlag === 'Critical' ? 'destructive' : 'default'}
                          className="text-xs"
                        >
                          {req.varianceFlag}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
                }}
              >
                Cancel
              </Button>
              <Button onClick={runPrediction} disabled={predictionLoading}>
                {predictionLoading ? 'Running...' : 'Run Prediction'}
              </Button>
            </div>

            {predicted && (
              <div className="mt-4 border-t pt-4 space-y-2">
                <p className="font-medium">Prediction Results</p>
                <p>
                  Fire Engines: <strong>{predicted.engines}</strong>
                </p>
                <p>
                  Ambulances: <strong>{predicted.ambulances}</strong>
                </p>
                <div className="flex justify-end gap-2 mt-2">
                  <Button onClick={populateRequestFromPrediction} disabled={units.length > 0}>
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
