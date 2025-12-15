import { CreateShiftForm } from "../CreateShiftForm";

export default function CreateShiftFormExample() {
  return (
    <CreateShiftForm
      onSubmit={(data) => console.log("Create shift:", data)}
      onCancel={() => console.log("Cancel")}
    />
  );
}
