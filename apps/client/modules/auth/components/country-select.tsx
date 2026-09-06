"use client";

import * as React from "react";
import {
  CountryDropdown,
  type Country,
} from "@workspace/ui/components/country-dropdown";

interface CountrySelectProps {
  onValueChange: (value: string) => void;
  defaultValue: string;
}

export function CountrySelect({
  onValueChange,
  defaultValue,
}: CountrySelectProps) {
  const handleCountryChange = (country: Country) => {
    onValueChange(country.alpha3);
  };

  return (
    <CountryDropdown
      defaultValue={defaultValue}
      onChange={handleCountryChange}
      placeholder="Select a country"
    />
  );
}
