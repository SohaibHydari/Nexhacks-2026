import React, { useState } from 'react';
import { useData, Bulletin } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { FilterBar } from '@/app/components/ics/FilterBar';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { format } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';

export const BulletinsScreen: React.FC = () => {
  const { user } = useAuth();
  const { bulletins, acknowledgeBulletin } = useData();
  const [searchValue, setSearchValue] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);

  const myBulletins = bulletins.filter(bull => 
    bull.recipients.includes(user?.role || '')
  );

  const filteredBulletins = myBulletins.filter(bull => {
    const matchesSearch = bull.title.toLowerCase().includes(searchValue.toLowerCase());
    const matchesUrgency = urgencyFilter === 'all' || bull.urgency === urgencyFilter;
    const matchesUnread = !unreadOnly || !bull.seenBy.includes(user?.id || '');
    return matchesSearch && matchesUrgency && matchesUnread;
  });

  const columns: Column[] = [
    { 
      key: 'title', 
      label: 'Title',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          {!row.seenBy.includes(user?.id || '') && (
            <div className="h-2 w-2 bg-blue-500 rounded-full" />
          )}
          <span className={!row.seenBy.includes(user?.id || '') ? 'font-semibold' : ''}>
            {value}
          </span>
        </div>
      )
    },
    { 
      key: 'urgency', 
      label: 'Urgency',
      render: (value) => (
        <Badge variant={value === 'High' ? 'destructive' : 'secondary'}>
          {value}
        </Badge>
      )
    },
    { 
      key: 'source', 
      label: 'Source'
    },
    { 
      key: 'createdAt', 
      label: 'Time',
      render: (value) => format(new Date(value), 'MMM d, h:mm a')
    },
  ];

  const handleBulletinClick = (bulletin: Bulletin) => {
    setSelectedBulletin(bulletin);
    if (!bulletin.seenBy.includes(user?.id || '')) {
      acknowledgeBulletin(bulletin.id, user?.id || '');
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Bulletins</h1>
        <p className="text-muted-foreground">
          Operational updates and notifications from command
        </p>
      </div>

      <div className="space-y-4">
        <FilterBar
          searchPlaceholder="Search bulletins..."
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          filters={[
            {
              id: 'urgency',
              label: 'Urgency',
              value: urgencyFilter,
              onChange: setUrgencyFilter,
              options: [
                { value: 'all', label: 'All' },
                { value: 'High', label: 'High' },
                { value: 'Normal', label: 'Normal' },
              ],
            },
          ]}
        />

        <div className="flex gap-2">
          <Button
            variant={unreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
          >
            Unread Only
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={filteredBulletins}
          onRowClick={handleBulletinClick}
          emptyMessage="No bulletins"
        />
      </div>

      {selectedBulletin && (
        <Sheet open={true} onOpenChange={() => setSelectedBulletin(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <SheetTitle>{selectedBulletin.title}</SheetTitle>
                  <SheetDescription>
                    {selectedBulletin.source} • {format(new Date(selectedBulletin.createdAt), 'MMM d, h:mm a')}
                  </SheetDescription>
                </div>
                {selectedBulletin.urgency === 'High' && (
                  <Badge variant="destructive">Urgent</Badge>
                )}
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="p-4 bg-accent rounded-lg whitespace-pre-wrap">
                {selectedBulletin.body}
              </div>

              {selectedBulletin.seenBy.includes(user?.id || '') && (
                <div className="text-sm text-muted-foreground">
                  ✓ Acknowledged
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
