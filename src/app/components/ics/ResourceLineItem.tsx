import React from 'react';
import { ResourceLine } from '@/app/contexts/DataContext';

interface ResourceLineItemProps {
  resource: ResourceLine;
  showOffered?: boolean;
  showApproved?: boolean;
}

export const ResourceLineItem: React.FC<ResourceLineItemProps> = ({
  resource,
  showOffered = false,
  showApproved = false,
}) => {
  return (
    <div className="flex items-center justify-between py-2 px-3 border rounded-lg bg-accent/30">
      <div className="flex-1">
        <p className="font-medium">{resource.resourceType}</p>
        {resource.substitution && (
          <p className="text-sm text-muted-foreground">
            Substitution: {resource.substitution}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Requested</p>
          <p className="font-semibold">{resource.qtyRequested}</p>
        </div>
        
        {showOffered && resource.qtyOffered !== undefined && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Offered</p>
            <p className="font-semibold text-orange-600">{resource.qtyOffered}</p>
          </div>
        )}
        
        {showApproved && resource.qtyApproved !== undefined && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="font-semibold text-green-600">{resource.qtyApproved}</p>
          </div>
        )}
      </div>
    </div>
  );
};
