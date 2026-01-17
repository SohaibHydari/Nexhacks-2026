import React, { createContext, useContext, useState, ReactNode } from 'react';

export type RequestStatus = 
  | 'Submitted' 
  | 'Under Review' 
  | 'Counteroffered' 
  | 'Approved' 
  | 'In Fulfillment' 
  | 'Fulfilled' 
  | 'Closed' 
  | 'Rejected';

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type VarianceFlag = 'OK' | 'Warning' | 'Critical';

export interface ResourceLine {
  id: string;
  resourceType: string;
  qtyRequested: number;
  qtyOffered?: number;
  qtyApproved?: number;
  substitution?: string;
  unitCost?: number;
}

export interface ResourcePrediction {
  id: string;
  resourceType: string;
  predictedCount: number;
  generatedAt: string;
}

export interface Request {
  id: string;
  incidentId: string;
  requesterId: string;
  requesterName: string;
  requesterOrg: string;
  priority: Priority;
  status: RequestStatus;
  neededBy: string;
  location: string;
  justification: string;
  patientImpact?: string;
  resources: ResourceLine[];
  varianceFlag?: VarianceFlag;
  decisionMessage?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface HospitalUpdate {
  id: string;
  hospitalName: string;
  timestamp: string;
  bedsAvailable: number;
  icuAvailable: number;
  bloodUnits: number;
  diversionStatus: boolean;
  icuDiversionStatus: boolean;
  notes: string;
}

export interface Bulletin {
  id: string;
  title: string;
  body: string;
  source: string;
  urgency: 'Normal' | 'High';
  recipients: string[];
  createdBy: string;
  createdAt: string;
  seenBy: string[];
  relatedUpdateId?: string;
}

export interface InventoryLot {
  id: string;
  resourceType: string;
  location: string;
  onHand: number;
  reserved: number;
  inTransit: number;
  unitCost: number;
  category: string;
}

export interface Fulfillment {
  id: string;
  requestId: string;
  lotId: string;
  resourceType: string;
  qty: number;
  origin: string;
  destination: string;
  eta: string;
  trackingRef?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface EventLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: any;
}

interface DataContextType {
  requests: Request[];
  hospitalUpdates: HospitalUpdate[];
  bulletins: Bulletin[];
  inventory: InventoryLot[];
  fulfillments: Fulfillment[];
  eventLogs: EventLog[];
  initialPredictions: ResourcePrediction[];
  addRequest: (request: Omit<Request, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => void;
  updateRequest: (id: string, updates: Partial<Request>) => void;
  addHospitalUpdate: (update: Omit<HospitalUpdate, 'id' | 'timestamp'>) => void;
  addBulletin: (bulletin: Omit<Bulletin, 'id' | 'createdAt' | 'seenBy'>) => void;
  acknowledgeBulletin: (bulletinId: string, userId: string) => void;
  updateInventory: (lotId: string, updates: Partial<InventoryLot>) => void;
  addFulfillment: (fulfillment: Omit<Fulfillment, 'id' | 'createdAt'>) => void;
  updateFulfillment: (id: string, updates: Partial<Fulfillment>) => void;
  logEvent: (event: Omit<EventLog, 'id' | 'timestamp'>) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

// Mock initial data
const initialRequests: Request[] = [
  {
    id: 'REQ-001',
    incidentId: 'INC-001',
    requesterId: '2',
    requesterName: 'Medic James Wilson',
    requesterOrg: 'EMS Station 12',
    priority: 'Critical',
    status: 'Under Review',
    neededBy: '2026-01-17T18:00:00',
    location: 'Sector Alpha',
    justification: 'Mass casualty incident - multiple patients requiring immediate transport',
    patientImpact: '15+ patients awaiting transport',
    resources: [
      { id: 'RL-001', resourceType: 'Ambulances', qtyRequested: 5 },
      { id: 'RL-002', resourceType: 'Paramedics', qtyRequested: 10 },
      { id: 'RL-003', resourceType: 'Medical Supplies - Trauma', qtyRequested: 50 },
    ],
    varianceFlag: 'Critical',
    createdAt: '2026-01-17T10:30:00',
    updatedAt: '2026-01-17T10:30:00',
    version: 1,
  },
  {
    id: 'REQ-002',
    incidentId: 'INC-001',
    requesterId: '3',
    requesterName: 'Captain Maria Rodriguez',
    requesterOrg: 'Fire Station 7',
    priority: 'High',
    status: 'Counteroffered',
    neededBy: '2026-01-17T16:00:00',
    location: 'North Perimeter',
    justification: 'Wildfire containment requires additional resources',
    resources: [
      { id: 'RL-004', resourceType: 'Fire Engines', qtyRequested: 3, qtyOffered: 2 },
      { id: 'RL-005', resourceType: 'Firefighters', qtyRequested: 15, qtyOffered: 10 },
      { id: 'RL-006', resourceType: 'Water Tenders', qtyRequested: 2, qtyOffered: 1 },
    ],
    varianceFlag: 'Warning',
    decisionMessage: 'Can provide 2 engines and 10 firefighters immediately. Additional resources available in 4 hours.',
    createdAt: '2026-01-17T09:15:00',
    updatedAt: '2026-01-17T11:20:00',
    version: 2,
  },
  {
    id: 'REQ-003',
    incidentId: 'INC-001',
    requesterId: '2',
    requesterName: 'Medic James Wilson',
    requesterOrg: 'EMS Station 12',
    priority: 'Medium',
    status: 'In Fulfillment',
    neededBy: '2026-01-17T15:00:00',
    location: 'Base Camp',
    justification: 'Replenish medical supplies for field operations',
    resources: [
      { id: 'RL-007', resourceType: 'IV Fluids', qtyRequested: 100, qtyApproved: 100 },
      { id: 'RL-008', resourceType: 'Bandages', qtyRequested: 200, qtyApproved: 200 },
    ],
    varianceFlag: 'OK',
    createdAt: '2026-01-17T08:00:00',
    updatedAt: '2026-01-17T10:45:00',
    version: 1,
  },
];

const initialHospitalUpdates: HospitalUpdate[] = [
  {
    id: 'HU-001',
    hospitalName: 'Central Regional Medical Center',
    timestamp: '2026-01-17T11:30:00',
    bedsAvailable: 12,
    icuAvailable: 2,
    bloodUnits: 45,
    diversionStatus: false,
    icuDiversionStatus: true,
    notes: 'ICU at capacity. Can accept general admissions.',
  },
  {
    id: 'HU-002',
    hospitalName: 'St. Mary\'s Hospital',
    timestamp: '2026-01-17T10:45:00',
    bedsAvailable: 5,
    icuAvailable: 0,
    bloodUnits: 20,
    diversionStatus: true,
    icuDiversionStatus: true,
    notes: 'On full diversion. Critical trauma only.',
  },
  {
    id: 'HU-003',
    hospitalName: 'Memorial Hospital',
    timestamp: '2026-01-17T11:15:00',
    bedsAvailable: 25,
    icuAvailable: 8,
    bloodUnits: 80,
    diversionStatus: false,
    icuDiversionStatus: false,
    notes: 'Ready to receive patients. Trauma team standing by.',
  },
];

const initialBulletins: Bulletin[] = [
  {
    id: 'BULL-001',
    title: 'URGENT: St. Mary\'s Hospital on Full Diversion',
    body: 'St. Mary\'s Hospital is now on full diversion status. Only critical trauma cases to be transported. ICU at 0 capacity. Redirect to Memorial Hospital or Central Regional.',
    source: 'IC Command',
    urgency: 'High',
    recipients: ['EMSFire'],
    createdBy: '1',
    createdAt: '2026-01-17T10:50:00',
    seenBy: [],
    relatedUpdateId: 'HU-002',
  },
  {
    id: 'BULL-002',
    title: 'Memorial Hospital Ready for Patient Influx',
    body: 'Memorial Hospital reports 25 beds and 8 ICU beds available. Trauma team standing by. Recommended primary transport destination.',
    source: 'IC Command',
    urgency: 'Normal',
    recipients: ['EMSFire'],
    createdBy: '1',
    createdAt: '2026-01-17T11:20:00',
    seenBy: [],
    relatedUpdateId: 'HU-003',
  },
];

const initialInventory: InventoryLot[] = [
  {
    id: 'LOT-001',
    resourceType: 'IV Fluids',
    location: 'Warehouse A',
    onHand: 500,
    reserved: 100,
    inTransit: 50,
    unitCost: 15,
    category: 'Medical Supplies',
  },
  {
    id: 'LOT-002',
    resourceType: 'Bandages',
    location: 'Warehouse A',
    onHand: 1000,
    reserved: 200,
    inTransit: 0,
    unitCost: 2,
    category: 'Medical Supplies',
  },
  {
    id: 'LOT-003',
    resourceType: 'Ambulances',
    location: 'Motor Pool',
    onHand: 8,
    reserved: 0,
    inTransit: 0,
    unitCost: 0,
    category: 'Vehicles',
  },
  {
    id: 'LOT-004',
    resourceType: 'Fire Engines',
    location: 'Fire Station Central',
    onHand: 5,
    reserved: 2,
    inTransit: 0,
    unitCost: 0,
    category: 'Vehicles',
  },
  {
    id: 'LOT-005',
    resourceType: 'Medical Supplies - Trauma',
    location: 'Warehouse B',
    onHand: 25,
    reserved: 0,
    inTransit: 20,
    unitCost: 150,
    category: 'Medical Supplies',
  },
];

const initialFulfillments: Fulfillment[] = [
  {
    id: 'FUL-001',
    requestId: 'REQ-003',
    lotId: 'LOT-001',
    resourceType: 'IV Fluids',
    qty: 100,
    origin: 'Warehouse A',
    destination: 'Base Camp',
    eta: '2026-01-17T14:30:00',
    trackingRef: 'TRK-12345',
    createdAt: '2026-01-17T10:45:00',
  },
];

const initialPredictions: ResourcePrediction[] = [
  {
    id: 'PRED-001',
    resourceType: 'Fire Engines',
    predictedCount: 4,
    generatedAt: '2026-01-17T07:30:00',
  },
  {
    id: 'PRED-002',
    resourceType: 'Ambulances',
    predictedCount: 6,
    generatedAt: '2026-01-17T07:30:00',
  },
];

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [hospitalUpdates, setHospitalUpdates] = useState<HospitalUpdate[]>(initialHospitalUpdates);
  const [bulletins, setBulletins] = useState<Bulletin[]>(initialBulletins);
  const [inventory, setInventory] = useState<InventoryLot[]>(initialInventory);
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>(initialFulfillments);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [predictions] = useState<ResourcePrediction[]>(initialPredictions);

  const addRequest = (request: Omit<Request, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => {
    const now = new Date().toISOString();
    const newRequest: Request = {
      ...request,
      id: `REQ-${String(requests.length + 1).padStart(3, '0')}`,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    setRequests(prev => [...prev, newRequest]);
    logEvent({
      actor: request.requesterName,
      action: 'Created Request',
      entityType: 'Request',
      entityId: newRequest.id,
      payload: newRequest,
    });
  };

  const updateRequest = (id: string, updates: Partial<Request>) => {
    setRequests(prev => prev.map(req => 
      req.id === id 
        ? { ...req, ...updates, updatedAt: new Date().toISOString(), version: req.version + 1 } 
        : req
    ));
    const updatedReq = requests.find(r => r.id === id);
    if (updatedReq) {
      logEvent({
        actor: 'System',
        action: 'Updated Request',
        entityType: 'Request',
        entityId: id,
        payload: updates,
      });
    }
  };

  const addHospitalUpdate = (update: Omit<HospitalUpdate, 'id' | 'timestamp'>) => {
    const newUpdate: HospitalUpdate = {
      ...update,
      id: `HU-${String(hospitalUpdates.length + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
    };
    setHospitalUpdates(prev => [newUpdate, ...prev]);
    logEvent({
      actor: update.hospitalName,
      action: 'Posted Hospital Update',
      entityType: 'HospitalUpdate',
      entityId: newUpdate.id,
      payload: newUpdate,
    });
  };

  const addBulletin = (bulletin: Omit<Bulletin, 'id' | 'createdAt' | 'seenBy'>) => {
    const newBulletin: Bulletin = {
      ...bulletin,
      id: `BULL-${String(bulletins.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      seenBy: [],
    };
    setBulletins(prev => [newBulletin, ...prev]);
    logEvent({
      actor: bulletin.createdBy,
      action: 'Published Bulletin',
      entityType: 'Bulletin',
      entityId: newBulletin.id,
      payload: newBulletin,
    });
  };

  const acknowledgeBulletin = (bulletinId: string, userId: string) => {
    setBulletins(prev => prev.map(bull =>
      bull.id === bulletinId && !bull.seenBy.includes(userId)
        ? { ...bull, seenBy: [...bull.seenBy, userId] }
        : bull
    ));
  };

  const updateInventory = (lotId: string, updates: Partial<InventoryLot>) => {
    setInventory(prev => prev.map(lot =>
      lot.id === lotId ? { ...lot, ...updates } : lot
    ));
  };

  const addFulfillment = (fulfillment: Omit<Fulfillment, 'id' | 'createdAt'>) => {
    const newFulfillment: Fulfillment = {
      ...fulfillment,
      id: `FUL-${String(fulfillments.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
    };
    setFulfillments(prev => [...prev, newFulfillment]);
    logEvent({
      actor: 'Logistics',
      action: 'Created Fulfillment',
      entityType: 'Fulfillment',
      entityId: newFulfillment.id,
      payload: newFulfillment,
    });
  };

  const updateFulfillment = (id: string, updates: Partial<Fulfillment>) => {
    setFulfillments(prev => prev.map(ful =>
      ful.id === id ? { ...ful, ...updates } : ful
    ));
    logEvent({
      actor: 'Logistics',
      action: 'Updated Fulfillment',
      entityType: 'Fulfillment',
      entityId: id,
      payload: updates,
    });
  };

  const logEvent = (event: Omit<EventLog, 'id' | 'timestamp'>) => {
    const newEvent: EventLog = {
      ...event,
      id: `EVT-${String(eventLogs.length + 1).padStart(6, '0')}`,
      timestamp: new Date().toISOString(),
    };
    setEventLogs(prev => [newEvent, ...prev]);
  };

  return (
    <DataContext.Provider value={{
      requests,
      hospitalUpdates,
      bulletins,
      inventory,
      fulfillments,
      eventLogs,
      initialPredictions: predictions,
      addRequest,
      updateRequest,
      addHospitalUpdate,
      addBulletin,
      acknowledgeBulletin,
      updateInventory,
      addFulfillment,
      updateFulfillment,
      logEvent,
    }}>
      {children}
    </DataContext.Provider>
  );
};
