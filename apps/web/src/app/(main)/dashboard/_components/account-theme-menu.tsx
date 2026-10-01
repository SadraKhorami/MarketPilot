"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

const themeOptions = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "System theme", icon: Monitor },
] as const;

export function AccountThemeMenu() {
  const { themeMode, setPreference } = usePreferencesStore(
    useShallow((state) => ({
      themeMode: state.values.theme_mode,
      setPreference: state.setPreference,
    })),
  );

  return (
    <DropdownMenuRadioGroup
      value={themeMode}
      aria-label="Color theme"
      className="flex items-center justify-center gap-6 px-3 py-1"
      onValueChange={(value) => {
        if (value === "light" || value === "dark" || value === "system") setPreference("theme_mode", value);
      }}
    >
      {themeOptions.map(({ value, label, icon: Icon }) => (
        <DropdownMenuRadioItem
          key={value}
          value={value}
          aria-label={label}
          title={label}
          textValue={label}
          onSelect={(event) => event.preventDefault()}
          className="flex size-11 justify-center p-0 text-muted-foreground after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-primary after:opacity-0 data-[state=checked]:text-foreground data-[state=checked]:after:opacity-100 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
        >
          <Icon />
          <span className="sr-only">{label}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
