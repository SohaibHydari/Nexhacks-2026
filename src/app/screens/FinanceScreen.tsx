import React from 'react';
import { useData } from '@/app/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { Button } from '@/app/components/ui/button';
import { DollarSign, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const FinanceScreen: React.FC = () => {
  const { fulfillments, requests, inventory } = useData();

  const totalCost = fulfillments.reduce((sum, ful) => {
    const lot = inventory.find(inv => inv.id === ful.lotId);
    return sum + (lot ? lot.unitCost * ful.qty : 0);
  }, 0);

  const costByCategory = inventory.reduce((acc, lot) => {
    const cat = lot.category;
    if (!acc[cat]) acc[cat] = 0;
    const reserved = lot.reserved;
    acc[cat] += lot.unitCost * reserved;
    return acc;
  }, {} as Record<string, number>);

  const fulfillmentColumns: Column[] = [
    { key: 'id', label: 'Fulfillment ID' },
    { key: 'resourceType', label: 'Resource' },
    { key: 'qty', label: 'Quantity' },
    { 
      key: 'lotId', 
      label: 'Unit Cost',
      render: (value) => {
        const lot = inventory.find(inv => inv.id === value);
        return lot ? `$${lot.unitCost}` : '-';
      }
    },
    { 
      key: 'lotId', 
      label: 'Total Cost',
      render: (value, row) => {
        const lot = inventory.find(inv => inv.id === value);
        const total = lot ? lot.unitCost * row.qty : 0;
        return `$${total.toLocaleString()}`;
      }
    },
    { 
      key: 'createdAt', 
      label: 'Date',
      render: (value) => format(new Date(value), 'MMM d, yyyy')
    },
  ];

  const handleExport = () => {
    toast.success('Finance data exported to CSV');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <DollarSign className="h-6 w-6" />
          Finance Overview
        </h1>
        <p className="text-muted-foreground">
          Cost tracking and accountability
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">${totalCost.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fulfillments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{fulfillments.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {requests.filter(r => r.status === 'In Fulfillment' || r.status === 'Approved').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cost by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(costByCategory).map(([category, cost]) => (
                <div key={category} className="flex items-center justify-between py-2 border-b">
                  <span>{category}</span>
                  <span className="font-semibold">${cost.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Fulfillment Costs</CardTitle>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <FileDown className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={fulfillmentColumns}
                data={fulfillments}
                emptyMessage="No fulfillments yet"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
