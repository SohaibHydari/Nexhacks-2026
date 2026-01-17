import React, { useState } from 'react';
import { useData } from '@/app/contexts/DataContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Package, AlertTriangle } from 'lucide-react';

export const InventoryScreen: React.FC = () => {
  const { inventory, requests } = useData();
  const [searchValue, setSearchValue] = useState('');

  const awaitingFulfillment = requests.filter(r => r.status === 'Approved');

  const inventoryColumns: Column[] = [
    { key: 'resourceType', label: 'Resource' },
    { key: 'location', label: 'Location' },
    { 
      key: 'onHand', 
      label: 'On Hand',
      render: (value, row) => {
        const isLow = value < 50;
        return (
          <span className={isLow ? 'text-orange-600 font-semibold' : ''}>
            {value}
          </span>
        );
      }
    },
    { key: 'reserved', label: 'Reserved' },
    { key: 'inTransit', label: 'In Transit' },
    { 
      key: 'category', 
      label: 'Category',
      render: (value) => <Badge variant="secondary">{value}</Badge>
    },
  ];

  const requestColumns: Column[] = [
    { key: 'id', label: 'Request ID' },
    { key: 'requesterOrg', label: 'Requester' },
    { 
      key: 'resources', 
      label: 'Items',
      render: (value) => `${value.length} items`
    },
  ];

  const filteredInventory = inventory.filter(item =>
    item.resourceType.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <Package className="h-6 w-6" />
          Logistics Inventory
        </h1>
        <p className="text-muted-foreground">
          Manage inventory and fulfill approved requests
        </p>
      </div>

      <div className="space-y-6">
        {/* Allocation Needed */}
        {awaitingFulfillment.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Allocation Needed ({awaitingFulfillment.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={requestColumns}
                data={awaitingFulfillment}
                emptyMessage="No requests awaiting fulfillment"
              />
            </CardContent>
          </Card>
        )}

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar
              searchPlaceholder="Search inventory..."
              searchValue={searchValue}
              onSearchChange={setSearchValue}
            />
            <DataTable
              columns={inventoryColumns}
              data={filteredInventory}
              emptyMessage="No inventory items"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
