"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { AnnouncementPreview } from "./announcement-preview";
import { type AnnouncementRecord, audienceLabels, destinations } from "./announcement-types";

const schema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120),
  body: z.string().trim().min(1, "Enter a message.").max(2000),
  audience: z.enum(["ALL", "USERS", "ADMINS"]),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  actionPath: z.string(),
});
export type AnnouncementInput = z.infer<typeof schema>;
export function AnnouncementEditor({
  draft,
  onClose,
  onSave,
}: {
  draft: AnnouncementRecord | null;
  onClose: () => void;
  onSave: (input: AnnouncementInput) => Promise<boolean>;
}) {
  const form = useForm<AnnouncementInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: draft?.title ?? "",
      body: draft?.body ?? "",
      audience: draft?.audience ?? "ALL",
      severity: draft?.severity ?? "INFO",
      actionPath: draft?.actionPath ?? "none",
    },
  });
  const values = form.watch();
  const saving = form.formState.isSubmitting;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{draft ? "Edit announcement" : "Create announcement"}</DialogTitle>
          <DialogDescription>
            Save a draft, review the audience and publish when ready. Messages stay inside MarketPilot.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(async (input) => {
            if (await onSave(input)) onClose();
          })}
        >
          <Tabs defaultValue="write">
            <TabsList className="mb-4">
              <TabsTrigger value="write">Write message</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="write">
              <FieldGroup>
                <Controller
                  control={form.control}
                  name="title"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="notice-title">Title</FieldLabel>
                      <Input
                        {...field}
                        id="notice-title"
                        maxLength={120}
                        disabled={saving}
                        aria-invalid={fieldState.invalid}
                        placeholder="A short, useful headline"
                      />
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="body"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="notice-body">Message</FieldLabel>
                      <Textarea
                        {...field}
                        id="notice-body"
                        rows={5}
                        maxLength={2000}
                        disabled={saving}
                        aria-invalid={fieldState.invalid}
                        placeholder="Explain what changed and what users should do."
                      />
                      <FieldDescription>{field.value.length} / 2,000 characters · plain text</FieldDescription>
                      <FieldError errors={[fieldState.error]} />
                    </Field>
                  )}
                />
                <FieldGroup className="sm:flex-row">
                  <Controller
                    control={form.control}
                    name="audience"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="notice-audience">Audience</FieldLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={saving}>
                          <SelectTrigger id="notice-audience" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.entries(audienceLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                  <Controller
                    control={form.control}
                    name="severity"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="notice-priority">Priority</FieldLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={saving}>
                          <SelectTrigger id="notice-priority" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="INFO">Information</SelectItem>
                              <SelectItem value="WARNING">Important</SelectItem>
                              <SelectItem value="CRITICAL">Urgent</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                </FieldGroup>
                <Controller
                  control={form.control}
                  name="actionPath"
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="notice-link">Related page</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={saving}>
                        <SelectTrigger id="notice-link" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {destinations.map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>Optional shortcut to an existing workspace page.</FieldDescription>
                    </Field>
                  )}
                />
              </FieldGroup>
            </TabsContent>
            <TabsContent value="preview">
              <AnnouncementPreview {...values} actionPath={values.actionPath === "none" ? null : values.actionPath} />
              <p className="mt-3 text-muted-foreground text-xs">
                Audience: {audienceLabels[values.audience]}. Optional notices honor each account’s in-app preference.
              </p>
            </TabsContent>
          </Tabs>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
