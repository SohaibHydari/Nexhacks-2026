import React, { useState } from 'react';
import { Request, useData } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { ResourceLineItem } from '@/app/components/ics/ResourceLineItem';
import { Timeline, TimelineEvent } from '@/app/components/ics/Timeline';
import { Badge } from '@/app/components/ui/badge';
import { format } from 'date-fns';
import { MapPin, Clock, User, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';

interface RequestDetailDrawerProps {
  request: Request;
  onClose: () => void;
}

export const RequestDetailDrawer: React.FC<RequestDetailDrawerProps> = ({ request, onClose }) => {
  const { user } = useAuth();
  const { updateRequest, logEvent } = useData();
  const [decisionMessage, setDecisionMessage] = useState('');
  const [showCounterOfferModal, setShowCounterOfferModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [counterOfferResources, setCounterOfferResources] = useState(request.resources);

  const isIC = user?.role === 'IC';
  const isRequester = user?.id === request.requesterId;

  const handleApprove = () => {
    if (!decisionMessage.trim()) {
      toast.error('Please provide a decision message');
      return;
    }
    updateRequest(request.id, {
      status: 'Approved',
      decisionMessage,
      resources: request.resources.map(r => ({ ...r, qtyApproved: r.qtyRequested })),
    });
    logEvent({
      actor: user?.name || 'IC',
      action: 'Approved Request',
      entityType: 'Request',
      entityId: request.id,
      payload: { message: decisionMessage },
    });
    toast.success('Request approved');
    setShowApproveModal(false);
    onClose();
  };

  const handleCounterOffer = () => {
    if (!decisionMessage.trim()) {
      toast.error('Please provide a rationale for the counteroffer');
      return;
    }
    updateRequest(request.id, {
      status: 'Counteroffered',
      decisionMessage,
      resources: counterOfferResources,
    });
    logEvent({
      actor: user?.name || 'IC',
      action: 'Counteroffered Request',
      entityType: 'Request',
      entityId: request.id,
      payload: { message: decisionMessage, resources: counterOfferResources },
    });
    toast.success('Counteroffer sent');
    setShowCounterOfferModal(false);
    onClose();
  };

  const handleReject = () => {
    if (!decisionMessage.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    updateRequest(request.id, {
      status: 'Rejected',
      decisionMessage,
    });
    logEvent({
      actor: user?.name || 'IC',
      action: 'Rejected Request',
      entityType: 'Request',
      entityId: request.id,
      payload: { message: decisionMessage },
    });
    toast.success('Request rejected');
    setShowRejectModal(false);
    onClose();
  };

  const handleAcceptCounterOffer = () => {
    updateRequest(request.id, {
      status: 'Approved',
      resources: request.resources.map(r => ({ ...r, qtyApproved: r.qtyOffered || r.qtyRequested })),
    });
    logEvent({
      actor: user?.name || 'Requester',
      action: 'Accepted Counteroffer',
      entityType: 'Request',
      entityId: request.id,
      payload: {},
    });
    toast.success('Counteroffer accepted');
    onClose();
  };

  const timelineEvents: TimelineEvent[] = [
    {
      id: '1',
      timestamp: request.createdAt,
      actor: request.requesterName,
      message: 'Created request',
    },
    {
      id: '2',
      timestamp: request.updatedAt,
      actor: 'System',
      message: `Status updated to ${request.status}`,
    },
  ];

  if (request.decisionMessage) {
    timelineEvents.push({
      id: '3',
      timestamp: request.updatedAt,
      actor: 'IC',
      message: request.decisionMessage,
    });
  }

  return (
    <>
      <Sheet open={true} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle>{request.id}</SheetTitle>
                <SheetDescription>{request.requesterOrg}</SheetDescription>
              </div>
              <StatusPill status={request.status} />
            </div>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Request Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Requester</p>
                  <p className="font-medium">{request.requesterName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={request.priority === 'Critical' ? 'destructive' : 'default'}>
                  {request.priority} Priority
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Needed By</p>
                  <p className="font-medium">{format(new Date(request.neededBy), 'MMM d, h:mm a')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{request.location}</p>
                </div>
              </div>
            </div>

            {/* Justification */}
            <div className="space-y-2">
              <h3 className="font-semibold">Justification</h3>
              <p className="text-sm text-muted-foreground">{request.justification}</p>
              {request.patientImpact && (
                <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">Patient Impact</p>
                    <p className="text-sm text-orange-700">{request.patientImpact}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Resource Lines */}
            <div className="space-y-2">
              <h3 className="font-semibold">Requested Resources</h3>
              <div className="space-y-2">
                {request.resources.map((resource) => (
                  <ResourceLineItem
                    key={resource.id}
                    resource={resource}
                    showOffered={request.status === 'Counteroffered'}
                    showApproved={request.status === 'Approved' || request.status === 'In Fulfillment' || request.status === 'Fulfilled'}
                  />
                ))}
              </div>
            </div>

            {/* Variance/Prediction Info */}
            {request.varianceFlag && request.varianceFlag !== 'OK' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-900">
                  Prediction Variance: {request.varianceFlag}
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Requested quantities differ from historical predictions for this resource type.
                </p>
              </div>
            )}

            {/* IC Decision Panel */}
            {isIC && (request.status === 'Submitted' || request.status === 'Under Review') && (
              <div className="space-y-3 p-4 bg-accent rounded-lg">
                <h3 className="font-semibold">Decision</h3>
                <Textarea
                  placeholder="Provide decision rationale (required)..."
                  value={decisionMessage}
                  onChange={(e) => setDecisionMessage(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button onClick={() => setShowApproveModal(true)} className="flex-1">
                    Approve
                  </Button>
                  <Button onClick={() => setShowCounterOfferModal(true)} variant="outline" className="flex-1">
                    Counteroffer
                  </Button>
                  <Button onClick={() => setShowRejectModal(true)} variant="destructive" className="flex-1">
                    Reject
                  </Button>
                </div>
              </div>
            )}

            {/* Requester Accept/Revise Counteroffer */}
            {isRequester && request.status === 'Counteroffered' && (
              <div className="space-y-3 p-4 bg-accent rounded-lg">
                <h3 className="font-semibold">Counteroffer Response</h3>
                {request.decisionMessage && (
                  <div className="p-3 bg-white rounded border">
                    <p className="text-sm text-muted-foreground">IC Message:</p>
                    <p className="text-sm">{request.decisionMessage}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleAcceptCounterOffer} className="flex-1">
                    Accept Counteroffer
                  </Button>
                  <Button variant="outline" className="flex-1">
                    Revise Request
                  </Button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-2">
              <h3 className="font-semibold">Activity Timeline</h3>
              <Timeline events={timelineEvents} />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Counteroffer Modal */}
      <Dialog open={showCounterOfferModal} onOpenChange={setShowCounterOfferModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Counteroffer - {request.id}</DialogTitle>
            <DialogDescription>
              Propose alternative quantities or substitutions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {counterOfferResources.map((resource, index) => (
              <div key={resource.id} className="p-4 border rounded-lg space-y-3">
                <p className="font-medium">{resource.resourceType}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Requested</Label>
                    <Input value={resource.qtyRequested} disabled />
                  </div>
                  <div>
                    <Label>Offered *</Label>
                    <Input
                      type="number"
                      value={resource.qtyOffered || resource.qtyRequested}
                      onChange={(e) => {
                        const newResources = [...counterOfferResources];
                        newResources[index].qtyOffered = parseInt(e.target.value) || 0;
                        setCounterOfferResources(newResources);
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label>Substitution (optional)</Label>
                  <Input
                    placeholder="Alternative resource type..."
                    value={resource.substitution || ''}
                    onChange={(e) => {
                      const newResources = [...counterOfferResources];
                      newResources[index].substitution = e.target.value;
                      setCounterOfferResources(newResources);
                    }}
                  />
                </div>
              </div>
            ))}
            <div>
              <Label>Rationale (required) *</Label>
              <Textarea
                placeholder="Explain the counteroffer reasoning..."
                value={decisionMessage}
                onChange={(e) => setDecisionMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCounterOfferModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCounterOffer}>
              Send Counteroffer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={showApproveModal} onOpenChange={setShowApproveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Request</DialogTitle>
            <DialogDescription>
              Confirm approval of {request.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              All requested resources will be approved as specified.
            </p>
            <div>
              <Label>Approval Message (required)</Label>
              <Textarea
                placeholder="Provide approval reasoning..."
                value={decisionMessage}
                onChange={(e) => setDecisionMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleApprove}>
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Confirm rejection of {request.id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-900">
                This action will reject the request. The requester will be notified.
              </p>
            </div>
            <div>
              <Label>Rejection Reason (required)</Label>
              <Textarea
                placeholder="Provide clear reasoning for rejection..."
                value={decisionMessage}
                onChange={(e) => setDecisionMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
