import React, { useMemo, useState } from 'react';
import { useData } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';
import { PlusCircle, Bell, FileText } from 'lucide-react';
import { Request, Bulletin, Unit, UnitStatus} from '@/app/contexts/DataContext';

interface FieldHomeScreenProps {
  onNavigateToCreateRequest: () => void;
  onNavigateToBulletins: () => void;
  onViewRequest: (request: Request) => void;
  onViewBulletin: (bulletin: Bulletin) => void;
}

export const FieldHomeScreen: React.FC<FieldHomeScreenProps> = ({
  onNavigateToCreateRequest,
  onNavigateToBulletins,
  onViewRequest,
  onViewBulletin,
}) => {
  const { user } = useAuth();
  const {
    requests,
    bulletins,
    acknowledgeBulletin,
    units,
    setUnitStatus,
    respondToRequest,
  } = useData() as any;

// EMS STATION VIEW (renders only for EMSFire role)
  // ============================================================
  const isEMS = user?.role === 'EMSFire';

  const emsUnits = useMemo(() => {
    // show only ambulances for EMS station
    return (units || []).filter((u: Unit) => u.type === 'Ambulance');
  }, [units]);

  const unitCounts = useMemo(() => {
    const counts = {
      Available: 0,
      'On Scene': 0,
      'In Transit to Scene': 0,
      'In Transit to Hospital': 0,
    };
    emsUnits.forEach((u: Unit) => {
      if (counts[u.status as keyof typeof counts] !== undefined) {
        counts[u.status as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [emsUnits]);

  // Incoming IC requests to EMS:
  // Hackathon filter: anything requesting "Ambulances"
  const incomingICRequests: Request[] = useMemo(() => {
    return requests.filter((r: Request) =>
      r.resources?.some(res => res.resourceType === 'Ambulances' && res.qtyRequested > 0)
    );
  }, [requests]);

  // Respond modal state
  const [respondOpen, setRespondOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<Request | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const availableAmbulances = useMemo(() => {
    return emsUnits.filter((u: Unit) => u.status === 'Available');
  }, [emsUnits]);

  const openRespond = (req: Request) => {
    setActiveRequest(req);
    setSelectedUnitIds([]);
    setNote('');
    setRespondOpen(true);
  };

  const toggleSelected = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  const submitResponse = () => {
    if (!activeRequest) return;

    respondToRequest(activeRequest.id, selectedUnitIds, note);

    // Optional: immediately mark them enroute (if your respondToRequest doesn't already)
    selectedUnitIds.forEach((id) => {
      setUnitStatus?.(id, 'In Transit to Scene' as UnitStatus);
    });

    setRespondOpen(false);
    setActiveRequest(null);
  };

  // EMS UI
  if (isEMS) {
    return (
      <div className="p-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-semibold mb-1">EMS Station</h1>
          <p className="text-muted-foreground">
            Monitor unit readiness and respond to IC dispatch requests
          </p>
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
                <CardTitle>All Ambulance Units</CardTitle>
                <Badge variant="outline">{emsUnits.length} Units</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {emsUnits.map((u: Unit) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-medium">{u.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {u.id}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {u.status}
                        </Badge>

                        {/* Optional manual status update */}
                        <select
                          className="border rounded-md px-2 py-1 text-sm"
                          value={u.status}
                          onChange={(e) => setUnitStatus(u.id, e.target.value as UnitStatus)}
                        >
                          <option>Available</option>
                          <option>On Scene</option>
                          <option>In Transit to Scene</option>
                          <option>In Transit to Hospital</option>
                        </select>
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
                {incomingICRequests.length > 0 && (
                  <Badge variant="destructive">{incomingICRequests.length} New</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {incomingICRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No incoming ambulance requests.
                  </p>
                ) : (
                  incomingICRequests.map((req) => {
                    const ambulanceLine = req.resources.find(r => r.resourceType === 'Ambulances');
                    const qty = ambulanceLine?.qtyRequested ?? 0;

                    return (
                      <div
                        key={req.id}
                        className="p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-sm">{req.id}</div>
                              <Badge variant="outline" className="text-xs">
                                {req.priority}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Needed: {qty} Ambulances • {req.location}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Needed by: {format(new Date(req.neededBy), 'MMM d, h:mm a')}
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
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Respond Modal (simple, no extra component deps) */}
        {respondOpen && activeRequest && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-lg font-semibold">Respond to {activeRequest.id}</div>
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
                  <b>{activeRequest.priority}</b>
                </div>

                <div className="border rounded-lg p-3 max-h-56 overflow-auto space-y-2">
                  {availableAmbulances.map((u: Unit) => (
                    <label key={u.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedUnitIds.includes(u.id)}
                          onChange={() => toggleSelected(u.id)}
                        />
                        <span className="text-sm">{u.name}</span>
                        <Badge variant="secondary" className="text-xs">{u.id}</Badge>
                      </div>
                      <Badge variant="outline" className="text-xs">{u.status}</Badge>
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
                  <Button onClick={submitResponse} disabled={selectedUnitIds.length === 0}>
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

  // ============================================================
  // ORIGINAL FIELD VIEW (non-EMS)
  // ============================================================

  // Filter requests created by this user
  const myRequests = requests.filter((req: Request) => req.requesterId === user?.id);

  // Filter bulletins for field personnel
  const myBulletins = bulletins.filter((bull: Bulletin) =>
    bull.recipients.includes(user?.role || '')
  );

  const unreadBulletins = myBulletins.filter((bull: Bulletin) =>
    !bull.seenBy.includes(user?.id || '')
  );

  const requestColumns: Column[] = [
    { key: 'id', label: 'Request ID' },
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
      key: 'updatedAt',
      label: 'Last Update',
      render: (value) => format(new Date(value), 'MMM d, h:mm a')
    },
  ];

  const handleAcknowledgeBulletin = (bulletinId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    acknowledgeBulletin(bulletinId, user?.id || '');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Field Operations</h1>
        <p className="text-muted-foreground">
          Manage resource requests and stay updated with bulletins
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Requests */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Requests</CardTitle>
              <Button onClick={onNavigateToCreateRequest}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Request
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={requestColumns}
                data={myRequests}
                onRowClick={onViewRequest}
                emptyMessage="No requests yet. Create your first request."
              />
            </CardContent>
          </Card>
        </div>

        {/* Bulletins Inbox */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Bulletins
              </CardTitle>
              {unreadBulletins.length > 0 && (
                <Badge variant="destructive">{unreadBulletins.length} New</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {myBulletins.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No bulletins
                </p>
              ) : (
                <>
                  {myBulletins.slice(0, 5).map((bulletin) => {
                    const isUnread = !bulletin.seenBy.includes(user?.id || '');
                    return (
                      <div
                        key={bulletin.id}
                        className={`p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors ${
                          isUnread ? 'border-blue-500 bg-blue-50' : ''
                        }`}
                        onClick={() => onViewBulletin(bulletin)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            {isUnread && (
                              <div className="h-2 w-2 bg-blue-500 rounded-full" />
                            )}
                            <p className="font-medium text-sm">{bulletin.title}</p>
                          </div>
                          {bulletin.urgency === 'High' && (
                            <Badge variant="destructive" className="text-xs">Urgent</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(bulletin.createdAt), 'h:mm a')}
                          </span>
                          {isUnread && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-6"
                              onClick={(e) => handleAcknowledgeBulletin(bulletin.id, e)}
                            >
                              Mark Read
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onNavigateToBulletins}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View All Bulletins
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
