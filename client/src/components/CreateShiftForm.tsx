import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@shared/permissions";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Send, Loader2, FileText, Save } from "lucide-react";
import type { Area, Position, OrganizationSetting, Shift, ShiftTemplate } from "@shared/schema";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  positionId: z.string().min(1, "Position is required"),
  areaId: z.string().min(1, "Area is required"),
  location: z.string().min(1, "Location is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  requirements: z.string().optional(),
  sendNotification: z.boolean().default(true),
  notifyAllAreas: z.boolean().default(false),
  saveAsTemplate: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

export interface CreateShiftFormProps {
  onSubmit?: (data: FormValues) => void;
  onCancel?: () => void;
  initialData?: Shift;
  isEditing?: boolean;
  isCloning?: boolean;
}

export function CreateShiftForm({ onSubmit, onCancel, initialData, isEditing, isCloning }: CreateShiftFormProps) {
  const { hasPermission } = usePermissions();
  const canNotifyAllAreas = hasPermission(PERMISSIONS.SHIFTS_ALL_AREAS);
  const { toast } = useToast();
  
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [pendingFormData, setPendingFormData] = useState<FormValues | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  const { data: areas = [], isLoading: areasLoading } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const { data: settings = [] } = useQuery<OrganizationSetting[]>({
    queryKey: ["/api/settings"],
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<ShiftTemplate[]>({
    queryKey: ["/api/shift-templates"],
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; positionId: string; areaId: string; location: string; startTime: string; endTime: string; requirements?: string; notifyAllAreas?: boolean }) => {
      const response = await apiRequest("POST", "/api/shift-templates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shift-templates"] });
      toast({
        title: "Template Saved",
        description: `Template "${templateName}" has been saved successfully.`,
      });
      setTemplateDialogOpen(false);
      setTemplateName("");
      if (pendingFormData) {
        onSubmit?.(pendingFormData);
        setPendingFormData(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Save Template",
        description: error.message || "An error occurred while saving the template.",
        variant: "destructive",
      });
    },
  });

  const locations = settings.find(s => s.key === "shift_locations")?.value?.split(",").map(l => l.trim()).filter(Boolean) || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      positionId: initialData?.positionId || "",
      areaId: initialData?.areaId || "",
      location: initialData?.location || "",
      date: initialData?.date || "",
      startTime: initialData?.startTime || "",
      endTime: initialData?.endTime || "",
      requirements: initialData?.requirements || "",
      sendNotification: !isEditing,
      notifyAllAreas: initialData?.notifyAllAreas || false,
      saveAsTemplate: false,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        positionId: initialData.positionId,
        areaId: initialData.areaId,
        location: initialData.location,
        date: initialData.date,
        startTime: initialData.startTime,
        endTime: initialData.endTime,
        requirements: initialData.requirements || "",
        sendNotification: false,
        notifyAllAreas: initialData.notifyAllAreas || false,
        saveAsTemplate: false,
      });
    }
  }, [initialData, form]);

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === "") return;
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      form.setValue("positionId", template.positionId);
      form.setValue("areaId", template.areaId);
      form.setValue("location", template.location);
      form.setValue("startTime", template.startTime);
      form.setValue("endTime", template.endTime);
      form.setValue("requirements", template.requirements || "");
      form.setValue("notifyAllAreas", template.notifyAllAreas || false);
      toast({
        title: "Template Loaded",
        description: `Loaded template "${template.name}". Don't forget to set the date.`,
      });
    }
  };

  const handleSubmit = (data: FormValues) => {
    if (data.saveAsTemplate && !isEditing) {
      setPendingFormData(data);
      setTemplateDialogOpen(true);
    } else {
      onSubmit?.(data);
    }
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please enter a name for the template.",
        variant: "destructive",
      });
      return;
    }
    if (!pendingFormData) return;

    saveTemplateMutation.mutate({
      name: templateName.trim(),
      positionId: pendingFormData.positionId,
      areaId: pendingFormData.areaId,
      location: pendingFormData.location,
      startTime: pendingFormData.startTime,
      endTime: pendingFormData.endTime,
      requirements: pendingFormData.requirements,
      notifyAllAreas: pendingFormData.notifyAllAreas,
    });
  };

  const handleSkipTemplate = () => {
    setTemplateDialogOpen(false);
    setTemplateName("");
    if (pendingFormData) {
      onSubmit?.(pendingFormData);
      setPendingFormData(null);
    }
  };

  return (
    <>
    <Card data-testid="form-create-shift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {isEditing ? "Edit Shift" : isCloning ? "Clone Shift" : "Post New Shift"}
        </CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <CardContent className="space-y-6">
            {!isEditing && templates.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 bg-muted/30">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <Label htmlFor="template-select" className="text-sm font-medium">
                    Load from Template
                  </Label>
                  <Select value={selectedTemplateId} onValueChange={handleTemplateSelect} disabled={templatesLoading}>
                    <SelectTrigger id="template-select" className="mt-1" data-testid="select-template">
                      {templatesLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </div>
                      ) : (
                        <SelectValue placeholder="Select a template to pre-fill form" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id} data-testid={`template-option-${template.id}`}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="positionId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={positionsLoading}>
                      <FormControl>
                        <SelectTrigger data-testid="select-position">
                          {positionsLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading...
                            </div>
                          ) : (
                            <SelectValue placeholder="Select position" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {positions.map((pos) => (
                          <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="areaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={areasLoading}>
                      <FormControl>
                        <SelectTrigger data-testid="select-area">
                          {areasLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading...
                            </div>
                          ) : (
                            <SelectValue placeholder="Select area" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {areas.map((area) => (
                          <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {canNotifyAllAreas && (
              <FormField
                control={form.control}
                name="notifyAllAreas"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-notify-all-areas"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-base font-medium cursor-pointer">
                        Notify All Areas
                      </FormLabel>
                      <FormDescription>
                        Send notifications to employees from all areas, not just the selected area. Use this to reach a wider pool of candidates.
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  {locations.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-location">
                          <SelectValue placeholder="Select location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input placeholder="e.g., Building A, Floor 2" {...field} data-testid="input-location" />
                    </FormControl>
                  )}
                  <FormDescription>
                    {locations.length === 0 && "Configure locations in Settings for dropdown"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} data-testid="input-start-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} data-testid="input-end-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any special requirements or qualifications needed..."
                      {...field}
                      data-testid="input-requirements"
                    />
                  </FormControl>
                  <FormDescription>
                    List any certifications or experience required for this shift.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sendNotification"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Send SMS Notification</FormLabel>
                    <FormDescription>
                      Notify employees in the selected area about this shift via SMS
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-notification"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {!isEditing && (
              <FormField
                control={form.control}
                name="saveAsTemplate"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 rounded-lg border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-save-as-template"
                      />
                    </FormControl>
                    <div className="space-y-1">
                      <FormLabel className="text-base font-medium cursor-pointer">
                        Save as Template
                      </FormLabel>
                      <FormDescription>
                        Save this shift configuration as a reusable template for future shifts
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-shift">
              Cancel
            </Button>
            <Button type="submit" data-testid="button-submit-shift">
              <Send className="h-4 w-4 mr-2" />
              {isEditing ? "Update Shift" : "Post Shift"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>

    <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save as Template
          </DialogTitle>
          <DialogDescription>
            Give your template a name so you can easily find and reuse it later.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g., Morning ICU Shift"
            className="mt-2"
            data-testid="input-template-name"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleSkipTemplate} data-testid="button-skip-template">
            Skip & Create Shift
          </Button>
          <Button 
            type="button" 
            onClick={handleSaveTemplate} 
            disabled={saveTemplateMutation.isPending}
            data-testid="button-save-template"
          >
            {saveTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
