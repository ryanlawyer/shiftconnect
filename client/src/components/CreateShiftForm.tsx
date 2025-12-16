import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Send, Loader2 } from "lucide-react";
import type { Area, Position, OrganizationSetting, Shift } from "@shared/schema";
import { useEffect } from "react";

const formSchema = z.object({
  positionId: z.string().min(1, "Position is required"),
  areaId: z.string().min(1, "Area is required"),
  location: z.string().min(1, "Location is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  requirements: z.string().optional(),
  sendNotification: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export interface CreateShiftFormProps {
  onSubmit?: (data: FormValues) => void;
  onCancel?: () => void;
  initialData?: Shift;
  isEditing?: boolean;
}

export function CreateShiftForm({ onSubmit, onCancel, initialData, isEditing }: CreateShiftFormProps) {
  const { data: areas = [], isLoading: areasLoading } = useQuery<Area[]>({
    queryKey: ["/api/areas"],
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const { data: settings = [] } = useQuery<OrganizationSetting[]>({
    queryKey: ["/api/settings"],
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
      });
    }
  }, [initialData, form]);

  const handleSubmit = (data: FormValues) => {
    onSubmit?.(data);
  };

  return (
    <Card data-testid="form-create-shift">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {isEditing ? "Edit Shift" : "Post New Shift"}
        </CardTitle>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <CardContent className="space-y-6">
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
                    <FormDescription>
                      Only employees assigned to this area will be notified
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
  );
}
