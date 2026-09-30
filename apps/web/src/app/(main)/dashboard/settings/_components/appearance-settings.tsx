"use client";
import { cn } from "cn";
import { Monitor, Moon, Sun } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
export function AppearanceSettings() {
  const { values, setPreference } = usePreferencesStore(
    useShallow((state) => ({ values: state.values, setPreference: state.setPreference })),
  );
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Workspace theme</CardTitle>
          <CardDescription>
            Choose a comfortable reading environment. Changes apply immediately and are saved in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <ToggleGroup
            type="single"
            variant="outline"
            value={values.theme_mode}
            onValueChange={(value) => {
              if (value === "light" || value === "dark" || value === "system") setPreference("theme_mode", value);
            }}
            className="w-full"
            aria-label="Workspace theme"
          >
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value} className="flex-1">
                <Icon data-icon="inline-start" />
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div aria-hidden="true" className="flex gap-3 rounded-xl border bg-background p-4">
            <div className="flex w-12 flex-col gap-2 rounded-lg bg-muted p-2">
              <div className="h-3 rounded bg-primary/30" />
              <div className="h-2 rounded bg-muted-foreground/20" />
              <div className="h-2 rounded bg-muted-foreground/20" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="h-3 w-1/3 rounded bg-foreground/20" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded border bg-card" />
                ))}
              </div>
              <div className="flex h-20 items-end gap-2 rounded-lg border bg-card p-3">
                {["h-4", "h-7", "h-5", "h-10", "h-8", "h-12"].map((height) => (
                  <div key={height} className={cn("flex-1 rounded-sm bg-primary/20", height)} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Layout preferences</CardTitle>
          <CardDescription>Keep the workspace comfortable on your screen.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="content-width">Content width</FieldLabel>
              <Select
                value={values.content_layout}
                onValueChange={(value) => {
                  if (value === "centered" || value === "full-width") setPreference("content_layout", value);
                }}
              >
                <SelectTrigger id="content-width">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="centered">Centered</SelectItem>
                    <SelectItem value="full-width">Full width</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>Centered content keeps wide screens easy to scan.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="header-behavior">Header behavior</FieldLabel>
              <Select
                value={values.navbar_style}
                onValueChange={(value) => {
                  if (value === "sticky" || value === "scroll") setPreference("navbar_style", value);
                }}
              >
                <SelectTrigger id="header-behavior">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="sticky">Stay visible</SelectItem>
                    <SelectItem value="scroll">Scroll with page</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
