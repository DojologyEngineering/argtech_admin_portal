"use client";

import * as React from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/app-dialog";
import { Field, FormGrid, FormSection } from "@/components/form/field";
import { FormSelect, stringOptions } from "@/components/form/form-select";
import { AddressFields } from "@/components/form/address-fields";
import { FileDrop } from "@/components/form/file-drop";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createFarmer, updateFarmer, type FarmerInput } from "@/lib/services/farmers";
import { EDUCATION_LEVELS, GENDERS, type Farmer } from "@/lib/types";

const EMPTY: FarmerInput = {
  firstName: "",
  lastName: "",
  gender: null,
  dateOfBirth: "",
  educationLevel: null,
  primaryPhone: "",
  secondaryPhone: "",
  province: "",
  district: "",
  commune: "",
  village: "",
  profilePhotoUrl: null,
  nationalIdUrl: null,
  additionalPhotoUrl: null,
  remark: "",
};

type Errors = Partial<Record<keyof FarmerInput, string>>;

/** Strips the fields the form does not own off an existing record. */
function toInput(farmer: Farmer | null | undefined): FarmerInput {
  if (!farmer) return EMPTY;
  const { id, createdAt, certificates, ...rest } = farmer;
  void id;
  void createdAt;
  void certificates;
  return rest;
}

/**
 * Create/edit farmer.
 *
 * Field agents normally capture this on the mobile tool; the portal keeps a
 * full editor so an admin can correct a typo or onboard someone who never went
 * through a field visit.
 *
 * Callers mount this only while it is open, so the form starts from the record
 * every time rather than being re-synced by an effect.
 */
export function FarmerFormDialog({
  open,
  onOpenChange,
  farmer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create a new farmer. */
  farmer?: Farmer | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FarmerInput>(() => toInput(farmer));
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof FarmerInput>(key: K, value: FarmerInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";
    if (!form.dateOfBirth) next.dateOfBirth = "Date of birth is required.";
    if (!form.primaryPhone.trim()) next.primaryPhone = "A contact number is required.";
    if (!form.province) next.province = "Province is required.";
    if (!form.district) next.district = "District is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Check the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      if (farmer) {
        await updateFarmer(farmer.id, form);
        toast.success(`${form.firstName} ${form.lastName} updated.`);
      } else {
        await createFarmer(form);
        toast.success(`${form.firstName} ${form.lastName} registered.`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the farmer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={farmer ? "Edit Farmer" : "Register New Farmer"}
      submitLabel={farmer ? "Update Farmer" : "Register Farmer"}
      submitting={submitting}
      onSubmit={handleSubmit}
    >
      <FormSection
        title="Personal Information"
        description="Basic identity and demographic details"
      >
        <FormGrid>
          <Field label="First Name" required error={errors.firstName} htmlFor="firstName">
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              placeholder="Enter first name"
              aria-invalid={Boolean(errors.firstName) || undefined}
            />
          </Field>
          <Field label="Last Name" required error={errors.lastName} htmlFor="lastName">
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              placeholder="Enter last name"
              aria-invalid={Boolean(errors.lastName) || undefined}
            />
          </Field>
          <Field label="Gender">
            <FormSelect
              value={form.gender ?? ""}
              onChange={(v) => set("gender", (v || null) as Farmer["gender"])}
              options={stringOptions([...GENDERS])}
              placeholder="Select gender"
            />
          </Field>
          <Field
            label="Date of Birth"
            required
            error={errors.dateOfBirth}
            hint="Used for age verification"
            htmlFor="dob"
          >
            <Input
              id="dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              aria-invalid={Boolean(errors.dateOfBirth) || undefined}
            />
          </Field>
          <Field label="Education Level">
            <FormSelect
              value={form.educationLevel ?? ""}
              onChange={(v) =>
                set("educationLevel", (v || null) as Farmer["educationLevel"])
              }
              options={stringOptions([...EDUCATION_LEVELS])}
              placeholder="Select level"
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Contact Information"
        description="Phone numbers for communication"
      >
        <FormGrid>
          <Field
            label="Primary Phone"
            required
            error={errors.primaryPhone}
            hint="Main contact number"
            htmlFor="primaryPhone"
          >
            <Input
              id="primaryPhone"
              inputMode="tel"
              value={form.primaryPhone}
              onChange={(e) => set("primaryPhone", e.target.value)}
              placeholder="e.g. 012345678"
              aria-invalid={Boolean(errors.primaryPhone) || undefined}
            />
          </Field>
          <Field label="Secondary Phone" hint="Optional backup number" htmlFor="secondaryPhone">
            <Input
              id="secondaryPhone"
              inputMode="tel"
              value={form.secondaryPhone}
              onChange={(e) => set("secondaryPhone", e.target.value)}
              placeholder="e.g. 098765432"
            />
          </Field>
        </FormGrid>
      </FormSection>

      <FormSection
        title="Location"
        description="Cascading address selection — select province first"
      >
        <AddressFields
          value={form}
          onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
          errors={{ province: errors.province, district: errors.district }}
        />
      </FormSection>

      <FormSection
        title="Documents"
        description="Upload identification and profile documents"
      >
        <FormGrid columns={3}>
          <FileDrop
            label="Profile Photo"
            value={form.profilePhotoUrl}
            onChange={(v) => set("profilePhotoUrl", v)}
          />
          <FileDrop
            label="National ID"
            value={form.nationalIdUrl}
            onChange={(v) => set("nationalIdUrl", v)}
          />
          <FileDrop
            label="Additional Photo"
            value={form.additionalPhotoUrl}
            onChange={(v) => set("additionalPhotoUrl", v)}
          />
        </FormGrid>
      </FormSection>

      <Field label="Remark" hint="Additional notes about this farmer" htmlFor="remark">
        <Textarea
          id="remark"
          rows={3}
          value={form.remark}
          onChange={(e) => set("remark", e.target.value)}
          placeholder="Any additional notes…"
        />
      </Field>
    </FormDialog>
  );
}
