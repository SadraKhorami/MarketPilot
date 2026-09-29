"use client";

import { useCallback, useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
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
import { type ApiEnvelope, ApiError, apiRequest } from "@/lib/api/client";

const schema = z.object({ name: z.string().trim().min(2).max(80), scope: z.enum(["read", "watchlists", "alerts"]) });
type ApiKeyFormValues = z.infer<typeof schema>;
type KeyRecord = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function ApiKeysWorkspace() {
  const [rows, setRows] = useState<KeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const form = useForm<ApiKeyFormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", scope: "read" } });

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiRequest<ApiEnvelope<KeyRecord[]>>("/api-keys");
      setRows(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load API keys.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createKey = async (input: ApiKeyFormValues) => {
    const scopes = input.scope === "read" ? ["watchlists:read", "alerts:read"] : [`${input.scope}:read`];
    try {
      const { data } = await apiRequest<ApiEnvelope<KeyRecord & { secret: string }>>("/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: input.name, scopes }),
      });
      setNewSecret(data.secret);
      setRows((current) => [{ ...data, revokedAt: null, lastUsedAt: null }, ...current]);
      form.reset();
      setDialogOpen(false);
      toast.success("API key created. Copy the secret now; it will not be shown again.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create an API key.");
    }
  };

  const revoke = async (id: string) => {
    try {
      await apiRequest(`/api-keys/${id}`, { method: "DELETE" });
      setRows((current) =>
        current.map((item) => (item.id === id ? { ...item, revokedAt: new Date().toISOString() } : item)),
      );
      toast.success("API key revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke the API key.");
    }
  };

  const copySecret = async () => {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    toast.success("API key copied to clipboard.");
  };

  const activeCount = rows.filter((row) => !row.revokedAt).length;

  return (
    <div className="space-y-4">
      {newSecret ? (
        <Alert>
          <KeyRound />
          <AlertTitle>Copy your new key now</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="break-all font-mono text-xs">{newSecret}</code>
            <Button variant="outline" size="sm" onClick={() => void copySecret()}>
              <Copy /> Copy key
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNewSecret(null)}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Active keys", String(activeCount), "Scoped credentials"],
          ["Default scope", "Least privilege", "Read access only"],
          ["Key rotation", "Available", "Revoke at any time"],
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
            <CardTitle className="text-base">API keys</CardTitle>
            <CardDescription>Create, review, or revoke programmatic credentials.</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus /> Create API key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>
                  The secret is shown once. Store it in a password manager or secret vault.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(createKey)} className="space-y-4">
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="key-name">Key name</FieldLabel>
                      <Input {...field} id="key-name" autoComplete="off" aria-invalid={fieldState.invalid} />
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
                          <SelectItem value="read">Watchlist + alert reads</SelectItem>
                          <SelectItem value="watchlists">Watchlist reads</SelectItem>
                          <SelectItem value="alerts">Alert reads</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Creating…" : "Create key"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground" role="status">
              Loading API keys…
            </p>
          ) : rows.length === 0 ? (
            <div className="m-4 rounded-lg border border-dashed p-8 text-center sm:m-0">
              <KeyRound className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 font-medium">No API keys yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a scoped key for a trusted integration.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <code className="font-mono text-xs">{row.prefix}••••</code>
                      </TableCell>
                      <TableCell>
                        {row.scopes.map((scope) => (
                          <Badge key={scope} variant="secondary" className="mr-1">
                            {scope}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : "Never"}</TableCell>
                      <TableCell>
                        <Badge variant={row.revokedAt ? "outline" : "default"}>
                          {row.revokedAt ? "Revoked" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.revokedAt ? null : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Revoke ${row.name}`}
                            onClick={() => void revoke(row.id)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        API key secrets are never stored in plaintext and cannot be retrieved after creation.
      </p>
    </div>
  );
}
