import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Bell, MessageSquare, Shield, User, MapPin, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Area } from "@shared/schema";

export default function Settings() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    shiftUpdates: true,
    trainingReminders: true,
    directMessages: true,
    smsAlerts: true,
  });

  const [profile, setProfile] = useState({
    name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    phone: "+1 (555) 456-7890",
  });

  // Area management state
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaForm, setAreaForm] = useState({ name: "", description: "", smsEnabled: true });

  const { data: areas = [], isLoading: areasLoading } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const createAreaMutation = useMutation({
    mutationFn: (data: { name: string; description: string; smsEnabled: boolean }) =>
      apiRequest("POST", "/api/areas", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setAreaDialogOpen(false);
      setAreaForm({ name: "", description: "", smsEnabled: true });
      toast({ title: "Area Created", description: "The new area has been added." });
    },
  });

  const updateAreaMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Area> }) =>
      apiRequest("PATCH", `/api/areas/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      setAreaDialogOpen(false);
      setEditingArea(null);
      setAreaForm({ name: "", description: "", smsEnabled: true });
      toast({ title: "Area Updated", description: "The area has been updated." });
    },
  });

  const deleteAreaMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/areas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/areas"] });
      toast({ title: "Area Deleted", description: "The area has been removed." });
    },
  });

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const openEditArea = (area: Area) => {
    setEditingArea(area);
    setAreaForm({ name: area.name, description: area.description || "", smsEnabled: area.smsEnabled });
    setAreaDialogOpen(true);
  };

  const openNewArea = () => {
    setEditingArea(null);
    setAreaForm({ name: "", description: "", smsEnabled: true });
    setAreaDialogOpen(true);
  };

  const handleAreaSubmit = () => {
    if (editingArea) {
      updateAreaMutation.mutate({ id: editingArea.id, data: areaForm });
    } else {
      createAreaMutation.mutate(areaForm);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, areas, and notification preferences</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              <CardTitle>Areas</CardTitle>
            </div>
            <Button size="sm" onClick={openNewArea} data-testid="button-add-area">
              <Plus className="h-4 w-4 mr-1" />
              Add Area
            </Button>
          </div>
          <CardDescription>Manage work areas for shift assignments and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          {areasLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : areas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No areas defined yet. Add your first area to get started.</p>
          ) : (
            <div className="space-y-2">
              {areas.map((area) => (
                <div
                  key={area.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`area-item-${area.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{area.name}</p>
                      {area.description && (
                        <p className="text-sm text-muted-foreground">{area.description}</p>
                      )}
                    </div>
                    {area.smsEnabled ? (
                      <Badge variant="secondary" className="text-xs">SMS enabled</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">SMS disabled</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditArea(area)}
                      data-testid={`button-edit-area-${area.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteAreaMutation.mutate(area.id)}
                      disabled={deleteAreaMutation.isPending}
                      data-testid={`button-delete-area-${area.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                data-testid="input-phone"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              data-testid="input-email"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
          </div>
          <CardDescription>Choose what notifications you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Shift Updates</Label>
              <p className="text-sm text-muted-foreground">Get notified about new shift openings</p>
            </div>
            <Switch
              checked={notifications.shiftUpdates}
              onCheckedChange={(checked) => setNotifications({ ...notifications, shiftUpdates: checked })}
              data-testid="switch-shift-updates"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Training Reminders</Label>
              <p className="text-sm text-muted-foreground">Receive reminders for upcoming training sessions</p>
            </div>
            <Switch
              checked={notifications.trainingReminders}
              onCheckedChange={(checked) => setNotifications({ ...notifications, trainingReminders: checked })}
              data-testid="switch-training-reminders"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Direct Messages</Label>
              <p className="text-sm text-muted-foreground">Get notified when someone messages you</p>
            </div>
            <Switch
              checked={notifications.directMessages}
              onCheckedChange={(checked) => setNotifications({ ...notifications, directMessages: checked })}
              data-testid="switch-direct-messages"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <Label>SMS Alerts</Label>
              </div>
              <p className="text-sm text-muted-foreground">Receive important updates via text message</p>
            </div>
            <Switch
              checked={notifications.smsAlerts}
              onCheckedChange={(checked) => setNotifications({ ...notifications, smsAlerts: checked })}
              data-testid="switch-sms-alerts"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>Manage your account security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" data-testid="button-change-password">
            Change Password
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} data-testid="button-save-settings">
          Save Changes
        </Button>
      </div>

      <Dialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen}>
        <DialogContent data-testid="dialog-area">
          <DialogHeader>
            <DialogTitle>{editingArea ? "Edit Area" : "Add New Area"}</DialogTitle>
            <DialogDescription>
              {editingArea ? "Update the area details below." : "Create a new area for shift assignments."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="area-name">Area Name</Label>
              <Input
                id="area-name"
                value={areaForm.name}
                onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                placeholder="e.g., Emergency Department"
                data-testid="input-area-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area-description">Description (Optional)</Label>
              <Input
                id="area-description"
                value={areaForm.description}
                onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                placeholder="Brief description of this area"
                data-testid="input-area-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable SMS Notifications</Label>
                <p className="text-sm text-muted-foreground">Send SMS to employees in this area for new shifts</p>
              </div>
              <Switch
                checked={areaForm.smsEnabled}
                onCheckedChange={(checked) => setAreaForm({ ...areaForm, smsEnabled: checked })}
                data-testid="switch-area-sms"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAreaSubmit}
              disabled={!areaForm.name || createAreaMutation.isPending || updateAreaMutation.isPending}
              data-testid="button-save-area"
            >
              {(createAreaMutation.isPending || updateAreaMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingArea ? "Save Changes" : "Create Area"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
