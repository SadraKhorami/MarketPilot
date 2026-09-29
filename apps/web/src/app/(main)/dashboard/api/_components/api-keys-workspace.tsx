"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, KeyRound, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const createKeySchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters.").max(48, "Use 48 characters or fewer."),
  scope: z.enum(["Read-only", "Read and write"]),
});
type CreateKeyInput = z.infer<typeof createKeySchema>;

const sampleRows = [
  {
    id: "DEMO-KEY-01",
    name: "Research notebook",
    prefix: "mp_demo_••••4a91",
    scope: "Read-only",
    created: "Example date",
    lastUsed: "Example · 2h ago",
  },
  {
    id: "DEMO-KEY-02",
    name: "Local dashboard",
    prefix: "mp_demo_••••8c2d",
    scope: "Read-only",
    created: "Example date",
    lastUsed: "Never · example",
  },
];

export function ApiKeysWorkspace() {
  const form = useForm<CreateKeyInput>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { name: "", scope: "Read-only" },
  });
  const onSubmit = (_input: CreateKeyInput) => {
    form.reset();
    toast.info("API key creation is not connected. No secret was generated or saved.");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Active keys", "0", "No real keys exist"],
          ["Default scope", "Read-only", "Least-privilege preview"],
          ["Key rotation", "Unavailable", "Backend not connected"],
        ].map(([label, value, detail]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 font-semibold text-xl">{value}</p>
              <p className="mt-1 text-muted-foreground text-xs">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Create a key</CardTitle>
            <CardDescription>Form preview only · no API key will be issued</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus /> Create API key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>
                  Configure a future key. Submitting this form does not create credentials.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="key-name">Key name</FieldLabel>
                      <Input
                        {...field}
                        id="key-name"
                        placeholder="e.g. Research notebook"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="scope"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="key-scope">Scope</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="key-scope" aria-invalid={fieldState.invalid}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Read-only">Read-only</SelectItem>
                          <SelectItem value="Read and write">Read and write</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
                <Alert>
                  <CircleAlert aria-hidden="true" />
                  <AlertTitle>Key service unavailable</AlertTitle>
                  <AlertDescription>
                    No secret is generated, displayed, or persisted in this frontend phase.
                  </AlertDescription>
                </Alert>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit">Preview request</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Alert>
            <KeyRound aria-hidden="true" />
            <AlertTitle>API credentials are not enabled</AlertTitle>
            <AlertDescription>
              Connect the MarketPilot API before issuing keys. Existing keys, usage, revocation, and last-used
              timestamps are not available.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Key records</CardTitle>
            <CardDescription>Fictional rows demonstrate the future table layout</CardDescription>
          </div>
          <Badge variant="outline">Sample only</Badge>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key prefix</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                      <span className="block font-mono text-muted-foreground text-xs">{row.id}</span>
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-xs">{row.prefix}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.scope}</Badge>
                    </TableCell>
                    <TableCell>{row.created}</TableCell>
                    <TableCell>{row.lastUsed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
