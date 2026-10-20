"use client";

import * as React from "react";
import {
  communeNames,
  districtNames,
  provinceNames,
  villageNames,
} from "@/lib/address";
import { Field, FormGrid } from "./field";
import { FormSelect, stringOptions } from "./form-select";

export interface AddressValue {
  province: string;
  district: string;
  commune: string;
  village: string;
}

/**
 * Cascading province → district → commune → village picker shared by the farmer
 * and plot forms. Choosing a level clears everything below it, so an address can
 * never be left in an inconsistent combination.
 */
export function AddressFields({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  disabled?: boolean;
  errors?: Partial<Record<keyof AddressValue, string>>;
}) {
  const districts = React.useMemo(
    () => districtNames(value.province),
    [value.province],
  );
  const communes = React.useMemo(
    () => communeNames(value.province, value.district),
    [value.province, value.district],
  );
  const villages = React.useMemo(
    () => villageNames(value.province, value.district, value.commune),
    [value.province, value.district, value.commune],
  );

  return (
    <FormGrid>
      <Field label="Province" required error={errors?.province}>
        <FormSelect
          value={value.province}
          onChange={(province) =>
            onChange({ province, district: "", commune: "", village: "" })
          }
          options={stringOptions(provinceNames())}
          placeholder="Select province"
          disabled={disabled}
          invalid={Boolean(errors?.province)}
        />
      </Field>

      <Field
        label="District"
        required
        error={errors?.district}
        hint={value.province ? undefined : "Select a province first"}
      >
        <FormSelect
          value={value.district}
          onChange={(district) =>
            onChange({ ...value, district, commune: "", village: "" })
          }
          options={stringOptions(districts)}
          placeholder="Select district"
          disabled={disabled || !value.province}
          invalid={Boolean(errors?.district)}
        />
      </Field>

      <Field label="Commune">
        <FormSelect
          value={value.commune}
          onChange={(commune) => onChange({ ...value, commune, village: "" })}
          options={stringOptions(communes)}
          placeholder="Select commune"
          disabled={disabled || !value.district}
        />
      </Field>

      <Field label="Village">
        <FormSelect
          value={value.village}
          onChange={(village) => onChange({ ...value, village })}
          options={stringOptions(villages)}
          placeholder="Select village"
          disabled={disabled || !value.commune}
        />
      </Field>
    </FormGrid>
  );
}
