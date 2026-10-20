"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Power } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ListToolbar } from "@/components/list-toolbar";
import { DataTable, type Column } from "@/components/data-table";
import { FormDialog } from "@/components/app-dialog";
import { Field, FormGrid } from "@/components/form/field";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createUser,
  listUsers,
  resetUserPassword,
  toggleUserStatus,
  updateUser,
  type UserInput,
} from "@/lib/services/users";
import { prettyDate } from "@/lib/format";
import { USER_ROLES, USER_STATUSES, type AppUser } from "@/lib/types";

export default function UsersPage() {
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [role, setRole] = React.useState("");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AppUser | null>(null);

  const refresh = React.useCallback(
    () =>
      listUsers().then((rows) => {
        setUsers(rows);
        setLoading(false);
      }),
    [],
  );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (role && u.role !== role) return false;
      if (!q) return true;
      return [u.username, u.fullName, u.email]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [users, query, role]);

  const handleToggle = async (user: AppUser) => {
    const next = await toggleUserStatus(user.id);
    toast.success(`${next.username} is now ${next.status.toLowerCase()}.`);
    void refresh();
  };

  const handleReset = async (user: AppUser) => {
    const temp = await resetUserPassword(user.id);
    toast.success(`Temporary password for ${user.username}: ${temp}`, {
      duration: 8000,
    });
  };

  const columns: Array<Column<AppUser>> = [
    {
      key: "username",
      header: "Username",
      primary: true,
      cell: (u) => <span className="font-medium">{u.username}</span>,
    },
    { key: "fullName", header: "Full Name", cell: (u) => u.fullName, subtitle: true },
    {
      key: "email",
      header: "Email",
      cell: (u) => <span className="text-muted-foreground">{u.email}</span>,
      hideBelow: "lg",
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => <StatusBadge status={u.role} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: "created",
      header: "Created",
      cell: (u) => prettyDate(u.createdAt),
      hideBelow: "xl",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle={`${users.length} team accounts`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add User
          </Button>
        }
      />

      <ListToolbar
        query={query}
        onQueryChange={setQuery}
        placeholder="Search users…"
      >
        <div className="w-full sm:w-44">
          <FormSelect
            value={role}
            onChange={setRole}
            options={[
              { value: "", label: "All roles" },
              ...stringOptions([...USER_ROLES]),
            ]}
            placeholder="All roles"
          />
        </div>
      </ListToolbar>

      <DataTable
        tableFrom="xl"
        columns={columns}
        rows={filtered}
        rowKey={(u) => u.id}
        loading={loading}
        emptyTitle="No users match this search"
        footer={`Showing ${filtered.length} of ${users.length}`}
        actions={(u) => (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${u.username}`}
              onClick={() => {
                setEditing(u);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${u.status === "Active" ? "Deactivate" : "Activate"} ${u.username}`}
              title={u.status === "Active" ? "Deactivate" : "Activate"}
              onClick={() => void handleToggle(u)}
            >
              <Power className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Reset password for ${u.username}`}
              title="Reset password"
              onClick={() => void handleReset(u)}
            >
              <KeyRound className="size-4" />
            </Button>
          </>
        )}
      />

      {formOpen ? (
        <UserFormDialog
          open
          onOpenChange={setFormOpen}
          user={editing}
          onSaved={() => void refresh()}
        />
      ) : null}
    </div>
  );
}

const EMPTY: UserInput = {
  username: "",
  fullName: "",
  email: "",
  role: "Staff",
  status: "Active",
};

function toInput(user: AppUser | null): UserInput {
  if (!user) return EMPTY;
  return {
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AppUser | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<UserInput>(() => toInput(user));
  const [errors, setErrors] = React.useState<Partial<Record<keyof UserInput, string>>>({});
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof UserInput>(key: K, value: UserInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    const next: Partial<Record<keyof UserInput, string>> = {};
    if (!form.username.trim()) next.username = "A username is required.";
    if (!form.fullName.trim()) next.fullName = "A full name is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Check the highlighted fields.");
      return;
    }

    setSubmitting(true);
    try {
      if (user) {
        await updateUser(user.id, form);
        toast.success(`${form.username} updated.`);
      } else {
        await createUser(form);
        toast.success(`${form.username} added to the team.`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the user.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={user ? "Edit User" : "Add User"}
      submitLabel={user ? "Update User" : "Create User"}
      submitting={submitting}
      onSubmit={handleSubmit}
      size="sm"
    >
      <div className="space-y-4">
        <Field label="Username" required error={errors.username} htmlFor="username">
          <Input
            id="username"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            placeholder="e.g. sophal"
            aria-invalid={Boolean(errors.username) || undefined}
          />
        </Field>
        <Field label="Full Name" required error={errors.fullName} htmlFor="fullName">
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="e.g. Sophal Chan"
            aria-invalid={Boolean(errors.fullName) || undefined}
          />
        </Field>
        <Field label="Email" required error={errors.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="name@argtech.com"
            aria-invalid={Boolean(errors.email) || undefined}
          />
        </Field>
        <FormGrid>
          <Field label="Role">
            <FormSelect
              value={form.role}
              onChange={(v) => set("role", v as AppUser["role"])}
              options={stringOptions([...USER_ROLES])}
            />
          </Field>
          <Field label="Status">
            <FormSelect
              value={form.status}
              onChange={(v) => set("status", v as AppUser["status"])}
              options={stringOptions([...USER_STATUSES])}
            />
          </Field>
        </FormGrid>
      </div>
    </FormDialog>
  );
}
