import React from 'react';
import { RequestStatus } from '@/app/contexts/DataContext';

interface StatusPillProps {
  status: RequestStatus | 'Diversion' | 'ICU Full' | 'Available' | 'Active' | 'Monitoring' | 'Closed';
  label?: string;
}

const statusColors: Record<string, string> = {
  'Submitted': 'bg-[var(--status-submitted)] text-white',
  'Under Review': 'bg-[var(--status-under-review)] text-white',
  'Counteroffered': 'bg-[var(--status-counteroffered)] text-white',
  'Approved': 'bg-[var(--status-approved)] text-white',
  'In Fulfillment': 'bg-[var(--status-in-fulfillment)] text-white',
  'Fulfilled': 'bg-[var(--status-fulfilled)] text-white',
  'Closed': 'bg-[var(--status-closed)] text-white',
  'Rejected': 'bg-[var(--status-rejected)] text-white',
  'Diversion': 'bg-red-500 text-white',
  'ICU Full': 'bg-orange-500 text-white',
  'Available': 'bg-green-500 text-white',
  'Active': 'bg-blue-500 text-white',
  'Monitoring': 'bg-yellow-500 text-white',
};

export const StatusPill: React.FC<StatusPillProps> = ({ status, label }) => {
  const colorClass = statusColors[status] || 'bg-gray-500 text-white';
  
  return (
    <span 
      className={`inline-flex items-center px-3 py-1 text-xs font-medium ${colorClass}`}
      style={{ borderRadius: 'var(--radius-pill)' }}
    >
      {label || status}
    </span>
  );
};
