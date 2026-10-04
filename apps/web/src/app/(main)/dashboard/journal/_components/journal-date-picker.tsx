"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localDate } from "./journal-dates";

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export function JournalDatePicker({
  id,
  value,
  onChange,
  dateOnly = false,
  disabled = false,
  readOnly = false,
  min,
  max,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  dateOnly?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const [zone, setZone] = useState("");
  const parsed = value ? new Date(dateOnly ? `${value}T00:00:00` : value) : undefined;
  const selected = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  const hour = value.slice(11, 13) || "00";
  const minute = value.slice(14, 16) || "00";
  function changeTime(part: "hour" | "minute", next: string) {
    const day = value.slice(0, 10) || localDate(new Date()).slice(0, 10);
    onChange(`${day}T${part === "hour" ? next : hour}:${part === "minute" ? next : minute}`);
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={Boolean(disabled) || Boolean(readOnly)}
          className="w-full min-w-0 justify-between"
        >
          <span className="truncate">
            {selected
              ? selected.toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  ...(dateOnly ? {} : { hour: "2-digit", minute: "2-digit", hour12: false }),
                })
              : "Select date"}
          </span>
          <CalendarIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)]">
        <Calendar
          mode="single"
          required
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(1900, 0)}
          endMonth={new Date(new Date().getFullYear() + 10, 11)}
          disabled={[
            ...(min ? [{ before: new Date(`${min}T00:00:00`) }] : []),
            ...(max ? [{ after: new Date(`${max}T00:00:00`) }] : []),
          ]}
          onSelect={(day) => {
            if (!day) return;
            const date = localDate(day).slice(0, 10);
            onChange(dateOnly ? date : `${date}T${hour}:${minute}`);
            if (dateOnly) setOpen(false);
          }}
        />
        {!dateOnly ? (
          <>
            <FieldGroup className="grid grid-cols-2 gap-3">
              {(["hour", "minute"] as const).map((part) => (
                <Field key={part}>
                  <FieldLabel htmlFor={`${id}-${part}`}>{part === "hour" ? "Hour · 24h" : "Minute"}</FieldLabel>
                  <Select value={part === "hour" ? hour : minute} onValueChange={(next) => changeTime(part, next)}>
                    <SelectTrigger id={`${id}-${part}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {(part === "hour" ? hours : minutes).map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </FieldGroup>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">{zone}</span>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
