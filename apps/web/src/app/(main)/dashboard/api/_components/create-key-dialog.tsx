"use client";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useApiResource } from "@/hooks/use-api-resource";

import { ResourceState } from "../../_components/resource-state";
import type { ApiCatalog } from "./api-types";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(80),
  scopes: z.array(z.string()).min(1, "Select at least one permission."),
});
export type CreateKeyInput = z.infer<typeof schema>;
export function CreateKeyDialog({
  onCreate,
  disabled = false,
}: {
  onCreate: (input: CreateKeyInput) => Promise<boolean>;
  disabled?: boolean;
}) {
  const catalog = useApiResource<ApiCatalog>("/api-keys/catalog");
  const [open, setOpen] = useState(false);
  const form = useForm<CreateKeyInput>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", scopes: ["market:read"] },
  });
  const submit = async (values: CreateKeyInput) => {
    if (!catalog.data || values.scopes.some((scope) => !catalog.data?.scopes.some((item) => item.id === scope))) {
      form.setError("scopes", { message: "Choose available permissions." });
      return;
    }
    if (await onCreate(values)) {
      setOpen(false);
      form.reset();
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!form.formState.isSubmitting) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus data-icon="inline-start" />
          Create key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Name your integration and choose only the data it needs. The secret is shown once.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="key-name">Name</FieldLabel>
                  <Input
                    {...field}
                    id="key-name"
                    placeholder="Research notebook"
                    autoComplete="off"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="scopes"
              render={({ field, fieldState }) => (
                <FieldSet>
                  <FieldLegend>Read permissions</FieldLegend>
                  <FieldDescription>Keys cannot change account settings or access administration.</FieldDescription>
                  <ResourceState {...catalog} retry={catalog.reload} />
                  {(catalog.error || catalog.loading ? [] : (catalog.data?.scopes ?? [])).map(
                    ({ id: scope, title }) => (
                      <Field key={scope} orientation="horizontal" data-invalid={fieldState.invalid}>
                        <Checkbox
                          id={`scope-${scope}`}
                          checked={field.value.includes(scope)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked ? [...field.value, scope] : field.value.filter((value) => value !== scope),
                            )
                          }
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel htmlFor={`scope-${scope}`}>
                          <span className="flex flex-col gap-1">
                            {title}
                            <code className="text-muted-foreground text-xs">{scope}</code>
                          </span>
                        </FieldLabel>
                      </Field>
                    ),
                  )}
                  <FieldError errors={[fieldState.error]} />
                </FieldSet>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={form.formState.isSubmitting}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || catalog.loading || !!catalog.error || !catalog.data}
              >
                {form.formState.isSubmitting ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
