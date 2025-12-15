import { CreateShiftForm } from "@/components/CreateShiftForm";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function NewShift() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = (data: any) => {
    console.log("Create shift:", data);
    toast({
      title: "Shift Posted",
      description: "The shift has been posted successfully.",
    });
    setLocation("/shifts");
  };

  const handleCancel = () => {
    setLocation("/shifts");
  };

  return (
    <div className="p-6 max-w-2xl mx-auto" data-testid="page-new-shift">
      <CreateShiftForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}
