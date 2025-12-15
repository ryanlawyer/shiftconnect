
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, UserPlus } from "lucide-react";
import type { Employee } from "@shared/schema";

// Schema for the form
const userFormSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserManagementDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    employee: (Employee & { user?: { id: string; username: string } | null }) | null;
}

export function UserManagementDialog({
    open,
    onOpenChange,
    employee,
}: UserManagementDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Mode based on whether employee already has a user account
    const isCreate = !employee?.user;

    const form = useForm<UserFormData>({
        resolver: zodResolver(userFormSchema),
        defaultValues: {
            username: employee?.email || "",
            password: "",
        },
        values: { // Update form when employee changes
            username: employee?.user?.username || employee?.email || "",
            password: "",
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: UserFormData) => {
            // We need to pass roleId from employee. 
            // If employee has no roleId, we might fail or default.
            if (!employee?.roleId) {
                throw new Error("Employee must have a role assigned before creating a user account.");
            }

            const res = await apiRequest("POST", "/api/admin/users", {
                ...data,
                employeeId: employee.id,
                roleId: employee.roleId,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
            toast({
                title: "User Account Created",
                description: `Account for ${employee?.name} created successfully.`,
            });
            onOpenChange(false);
            form.reset();
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to create account",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const resetPasswordMutation = useMutation({
        mutationFn: async (data: Pick<UserFormData, "password">) => {
            if (!employee?.user?.id) throw new Error("No user found");

            const res = await apiRequest("POST", `/api/admin/users/${employee.user.id}/reset-password`, {
                password: data.password,
            });
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Password Reset",
                description: "Password has been updated successfully.",
            });
            onOpenChange(false);
            form.reset();
        },
        onError: (error: Error) => {
            toast({
                title: "Failed to reset password",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const onSubmit = (data: UserFormData) => {
        if (isCreate) {
            createMutation.mutate(data);
        } else {
            resetPasswordMutation.mutate({ password: data.password });
        }
    };

    if (!employee) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>
                        {isCreate ? "Create User Account" : "Reset Password"}
                    </DialogTitle>
                    <DialogDescription>
                        {isCreate
                            ? `Create a login for ${employee.name}. They will be able to log in with these credentials.`
                            : `Reset the password for ${employee.name}'s account (${employee.user?.username}).`}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            {...form.register("username")}
                            disabled={!isCreate} // Cannot change username after creation in this dialog
                        />
                        {form.formState.errors.username && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.username.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">
                            {isCreate ? "Password" : "New Password"}
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            {...form.register("password")}
                        />
                        {form.formState.errors.password && (
                            <p className="text-sm text-destructive">
                                {form.formState.errors.password.message}
                            </p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending || resetPasswordMutation.isPending}
                        >
                            {(createMutation.isPending || resetPasswordMutation.isPending) && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {isCreate ? (
                                <>
                                    <UserPlus className="mr-2 h-4 w-4" /> Create Account
                                </>
                            ) : (
                                <>
                                    <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
