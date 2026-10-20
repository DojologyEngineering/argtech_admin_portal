"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { FormDialog } from "@/components/app-dialog";
import { Field, FormGrid, FormSection } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createBuyer, updateBuyer, type BuyerInput } from "@/lib/services/buyers";
import type { Buyer } from "@/lib/types";

type Address = BuyerInput["addresses"][number];

const EMPTY_ADDRESS: Address = { label: "", line: "", district: "", city: "" };

function toInput(buyer: Buyer | null | undefined, name: string): BuyerInput {
  if (!buyer) {
    return { name, contactPerson: "", phone: "", email: "", addresses: [] };
  }
  return {
    name: buyer.name,
    contactPerson: buyer.contactPerson,
    phone: buyer.phone,
    email: buyer.email,
    addresses: buyer.addresses.map((a) => ({ ...a })),
  };
}

/**
 * Add or edit a buyer. Used on the Buyers page and from the order form's
 * "New buyer" action, so a buyer is never created silently from typed text.
 */
export function BuyerFormDialog({
  open,
  onOpenChange,
  buyer,
  initialName = "",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyer?: Buyer | null;
  initialName?: string;
  onSaved: (buyer: Buyer) => void;
}) {
  const [form, setForm] = React.useState<BuyerInput>(() =>
    toInput(buyer, initialName),
  );
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof BuyerInput>(key: K, value: BuyerInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setAddress = (index: number, patch: Partial<Address>) =>
    set(
      "addresses",
      form.addresses.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    );

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setNameError("A buyer name is required.");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    try {
      const saved = buyer
        ? await updateBuyer(buyer.id, form)
        : await createBuyer(form);
      toast.success(buyer ? `${saved.name} updated.` : `${saved.name} added.`);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the buyer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={buyer ? "Edit Buyer" : "Add Buyer"}
      description="Company details and delivery addresses"
      submitLabel={buyer ? "Update Buyer" : "Add Buyer"}
      submitting={submitting}
      onSubmit={handleSubmit}
      size="md"
    >
      <FormSection title="Company">
        <FormGrid>
          <Field label="Name" required error={nameError} htmlFor="buyerName">
            <Input
              id="buyerName"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Fresh Market Ltd."
              aria-invalid={Boolean(nameError) || undefined}
            />
          </Field>
          <Field label="Contact person" htmlFor="buyerContact">
            <Input
              id="buyerContact"
              value={form.contactPerson}
              onChange={(e) => set("contactPerson", e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="buyerPhone">
            <Input
              id="buyerPhone"
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+855 …"
            />
          </Field>
          <Field label="Email" htmlFor="buyerEmail">
            <Input
              id="buyerEmail"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Delivery addresses"
        description="Where this buyer receives delivery orders"
      >
        {form.addresses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
            No delivery address yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {form.addresses.map((address, index) => (
              <li
                key={address.id ?? `new-${index}`}
                className="rounded-xl bg-muted/40 p-3.5"
              >
                <div className="flex items-start gap-2">
                  <FormGrid className="flex-1">
                    <Field label="Name">
                      <Input
                        value={address.label}
                        onChange={(e) => setAddress(index, { label: e.target.value })}
                        placeholder="e.g. Main store"
                        aria-label={`Address ${index + 1} name`}
                      />
                    </Field>
                    <Field label="Street address">
                      <Input
                        value={address.line}
                        onChange={(e) => setAddress(index, { line: e.target.value })}
                        aria-label={`Address ${index + 1} street`}
                      />
                    </Field>
                    <Field label="District">
                      <Input
                        value={address.district}
                        onChange={(e) =>
                          setAddress(index, { district: e.target.value })
                        }
                        aria-label={`Address ${index + 1} district`}
                      />
                    </Field>
                    <Field label="City">
                      <Input
                        value={address.city}
                        onChange={(e) => setAddress(index, { city: e.target.value })}
                        aria-label={`Address ${index + 1} city`}
                      />
                    </Field>
                  </FormGrid>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove address ${index + 1}`}
                    onClick={() =>
                      set(
                        "addresses",
                        form.addresses.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => set("addresses", [...form.addresses, { ...EMPTY_ADDRESS }])}
        >
          <Plus className="size-3.5" />
          Add address
        </Button>
      </FormSection>
    </FormDialog>
  );
}
