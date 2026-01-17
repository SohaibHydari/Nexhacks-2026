import React from 'react';
import { format } from 'date-fns';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  message: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary" />
            {index < events.length - 1 && (
              <div className="w-px h-full bg-border mt-1" />
            )}
          </div>
          
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{event.actor}</p>
                <p className="text-sm text-muted-foreground">{event.message}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(event.timestamp), 'MMM d, h:mm a')}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
