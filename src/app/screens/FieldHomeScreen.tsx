import React, { useState } from 'react';
import { useData } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { DataTable, Column } from '@/app/components/ics/DataTable';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';
import { PlusCircle, Bell, FileText } from 'lucide-react';
import { Request, Bulletin } from '@/app/contexts/DataContext';

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
  const { requests, bulletins, acknowledgeBulletin } = useData();

  // Filter requests created by this user
  const myRequests = requests.filter(req => req.requesterId === user?.id);

  // Filter bulletins for field personnel
  const myBulletins = bulletins.filter(bull => 
    bull.recipients.includes(user?.role || '')
  );

  const unreadBulletins = myBulletins.filter(bull => 
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
