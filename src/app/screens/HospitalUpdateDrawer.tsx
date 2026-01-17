import React, { useState } from 'react';
import { HospitalUpdate, useData } from '@/app/contexts/DataContext';
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
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { StatusPill } from '@/app/components/ics/StatusPill';
import { format } from 'date-fns';
import { Building2, Bed, Heart, Droplet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { toast } from 'sonner';

interface HospitalUpdateDrawerProps {
  update: HospitalUpdate;
  onClose: () => void;
}

export const HospitalUpdateDrawer: React.FC<HospitalUpdateDrawerProps> = ({ update, onClose }) => {
  const { user } = useAuth();
  const { addBulletin } = useData();
  const [showBulletinModal, setShowBulletinModal] = useState(false);
  const [bulletinTitle, setBulletinTitle] = useState('');
  const [bulletinBody, setBulletinBody] = useState('');
  const [bulletinUrgency, setBulletinUrgency] = useState<'Normal' | 'High'>('Normal');
  const [recipients, setRecipients] = useState({ EMS: true, Fire: true });

  const isIC = user?.role === 'IC';

  const handlePushBulletin = () => {
    // Auto-populate bulletin from hospital update
    const title = `${update.hospitalName} - ${update.diversionStatus ? 'DIVERSION' : 'Status Update'}`;
    const body = `${update.hospitalName} Status Update (${format(new Date(update.timestamp), 'h:mm a')}):
    
Beds Available: ${update.bedsAvailable}
ICU Beds: ${update.icuAvailable}
Blood Units: ${update.bloodUnits}
${update.diversionStatus ? '⚠️ ON DIVERSION' : ''}
${update.icuDiversionStatus ? '⚠️ ICU DIVERSION' : ''}

Notes: ${update.notes}`;

    setBulletinTitle(title);
    setBulletinBody(body);
    setBulletinUrgency(update.diversionStatus || update.icuDiversionStatus ? 'High' : 'Normal');
    setShowBulletinModal(true);
  };

  const handlePublishBulletin = () => {
    if (!bulletinTitle.trim() || !bulletinBody.trim()) {
      toast.error('Title and body are required');
      return;
    }

    const recipientList = [];
    if (recipients.EMS) recipientList.push('EMS');
    if (recipients.Fire) recipientList.push('Fire');

    if (recipientList.length === 0) {
      toast.error('Select at least one recipient');
      return;
    }

    addBulletin({
      title: bulletinTitle,
      body: bulletinBody,
      source: 'IC Command',
      urgency: bulletinUrgency,
      recipients: recipientList,
      createdBy: user?.id || '1',
      relatedUpdateId: update.id,
    });

    toast.success('Bulletin published to field units');
    setShowBulletinModal(false);
    onClose();
  };

  return (
    <>
      <Sheet open={true} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {update.hospitalName}
                </SheetTitle>
                <SheetDescription>
                  Updated {format(new Date(update.timestamp), 'MMM d, yyyy h:mm a')}
                </SheetDescription>
              </div>
              <div className="flex gap-2">
                {update.diversionStatus && <StatusPill status="Diversion" />}
                {update.icuDiversionStatus && <StatusPill status="ICU Full" />}
                {!update.diversionStatus && !update.icuDiversionStatus && (
                  <StatusPill status="Available" />
                )}
              </div>
            </div>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Capacity Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <Bed className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-semibold">{update.bedsAvailable}</p>
                <p className="text-sm text-muted-foreground">Beds Available</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <Heart className="h-6 w-6 mx-auto mb-2 text-red-600" />
                <p className="text-2xl font-semibold">{update.icuAvailable}</p>
                <p className="text-sm text-muted-foreground">ICU Beds</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <Droplet className="h-6 w-6 mx-auto mb-2 text-red-600" />
                <p className="text-2xl font-semibold">{update.bloodUnits}</p>
                <p className="text-sm text-muted-foreground">Blood Units</p>
              </div>
            </div>

            {/* Diversion Status */}
            <div className="space-y-3">
              <h3 className="font-semibold">Diversion Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">General Diversion</span>
                  <span className={`text-sm font-medium ${update.diversionStatus ? 'text-red-600' : 'text-green-600'}`}>
                    {update.diversionStatus ? 'ON DIVERSION' : 'Accepting'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">ICU Diversion</span>
                  <span className={`text-sm font-medium ${update.icuDiversionStatus ? 'text-red-600' : 'text-green-600'}`}>
                    {update.icuDiversionStatus ? 'ON DIVERSION' : 'Accepting'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <h3 className="font-semibold">Notes</h3>
              <div className="p-4 bg-accent rounded-lg">
                <p className="text-sm">{update.notes}</p>
              </div>
            </div>

            {/* Push as Bulletin (IC only) */}
            {isIC && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <h3 className="font-semibold text-blue-900">Broadcast to Field Units</h3>
                <p className="text-sm text-blue-700">
                  Convert this hospital update into a bulletin for EMS and Fire personnel
                </p>
                <Button onClick={handlePushBulletin} className="w-full">
                  Push as Bulletin
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Push Bulletin Modal */}
      <Dialog open={showBulletinModal} onOpenChange={setShowBulletinModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Push Bulletin to Field</DialogTitle>
            <DialogDescription>
              Broadcast hospital update to field personnel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={bulletinTitle}
                onChange={(e) => setBulletinTitle(e.target.value)}
                placeholder="Bulletin title..."
              />
            </div>
            <div>
              <Label>Message Body *</Label>
              <Textarea
                value={bulletinBody}
                onChange={(e) => setBulletinBody(e.target.value)}
                rows={8}
                placeholder="Bulletin content..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Urgency</Label>
                <Select value={bulletinUrgency} onValueChange={(v) => setBulletinUrgency(v as 'Normal' | 'High')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Recipients *</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="ems"
                      checked={recipients.EMS}
                      onCheckedChange={(checked) => setRecipients({ ...recipients, EMS: checked as boolean })}
                    />
                    <label htmlFor="ems" className="text-sm cursor-pointer">
                      EMS
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="fire"
                      checked={recipients.Fire}
                      onCheckedChange={(checked) => setRecipients({ ...recipients, Fire: checked as boolean })}
                    />
                    <label htmlFor="fire" className="text-sm cursor-pointer">
                      Fire
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulletinModal(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublishBulletin}>
              Publish Bulletin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
