import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bell, MessageSquare, Shield, User } from "lucide-react";

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

  const handleSave = () => {
    console.log("Save settings:", { notifications, profile });
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and notification preferences</p>
      </div>

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
    </div>
  );
}
