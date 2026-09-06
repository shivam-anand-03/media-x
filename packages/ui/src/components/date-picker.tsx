"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/utils";
import { formatDisplayDate, toValidDate } from "@workspace/ui/lib/date-utils";

interface DatePickerProps {
  /** Selected value — an ISO date string ("YYYY-MM-DD"), a Date, or empty. */
  value?: string | Date | null;
  /** Called with the picked date as an ISO date string, or "" when cleared. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** date-fns format token for the trigger label. */
  dateFormat?: string;
  /** Extra classes for the trigger button. */
  className?: string;
  /** Disable specific days (react-day-picker matcher). */
  disabled?: (date: Date) => boolean;
  captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"];
  id?: string;
}

/**
 * Reusable single-date picker for form fields. Parses its value defensively
 * (via toValidDate) so a malformed stored value can never crash date-fns.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  dateFormat = "PPP",
  className,
  disabled,
  captionLayout = "dropdown",
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = toValidDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          className={cn(
            "w-full justify-start rounded-xl text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
          {formatDisplayDate(value, placeholder, dateFormat)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? new Date()}
          captionLayout={captionLayout}
          disabled={disabled}
          onSelect={(date) => {
            onChange(date ? (date.toISOString().split("T")[0] ?? "") : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function DatePickerWithRange() {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 20),
    to: addDays(new Date(new Date().getFullYear(), 0, 20), 20),
  });

  return (
    <Field className="mx-auto w-60">
      <FieldLabel htmlFor="date-picker-range">Date Picker Range</FieldLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date-picker-range"
            className="justify-start px-2.5 font-normal"
          >
            <CalendarIcon />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
