"use client";
import { useState } from "react";

import Link from "next/link";

import { Activity, Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiResource } from "@/hooks/use-api-resource";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

import { CollectionPagination } from "../../_components/collection-pagination";
import { ResourceState } from "../../_components/resource-state";
import type { KeyRecord } from "./api-types";
import { CreateKeyDialog, type CreateKeyInput } from "./create-key-dialog";
import { getKeyStatus } from "./key-status";
export function ApiKeysWorkspace() {
  const resource = useApiResource<KeyRecord[]>("/api-keys");
  const [newSecret, setNewSecret] = useState<{ id: string; name: string; secret: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<KeyRecord | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const rows = resource.data ?? [];
  const create = async (input: CreateKeyInput) => {
    try {
      const { data } = await apiRequest<ApiEnvelope<KeyRecord & { secret: string }>>("/api-keys", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setNewSecret({ id: data.id, name: data.name, secret: data.secret });
      resource.reload();
      setPage(1);
      toast.success("Key created. Save your secret now.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create key.");
      return false;
    }
  };
  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await apiRequest(`/api-keys/${revokeTarget.id}`, { method: "DELETE" });
      resource.reload();
      if (newSecret?.id === revokeTarget.id) setNewSecret(null);
      setRevokeTarget(null);
      toast.success("Key revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke key.");
    } finally {
      setRevoking(false);
    }
  };
  const copy = async () => {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret.secret);
      toast.success("Key copied.");
    } catch {
      toast.error("Clipboard unavailable. Select and copy your key manually.");
    }
  };
  return (
    <div className="flex flex-col gap-5">
      {newSecret && (
        <Alert className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <AlertTitle>Save {newSecret.name} — shown once</AlertTitle>
              <AlertDescription className="mt-1">
                <code className="block break-all font-mono text-xs">{newSecret.secret}</code>
              </AlertDescription>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <Button size="sm" variant="outline" onClick={() => void copy()}>
              <Copy data-icon="inline-start" />
              Copy key
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewSecret(null)}>
              Dismiss
            </Button>
          </div>
        </Alert>
      )}
      <Card>
        <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <CardTitle>Your API keys</CardTitle>
            <CardDescription>
              Read-only credentials for scripts and integrations. Revoke a key to stop its access immediately.
            </CardDescription>
          </div>
          <CardAction className="shrink-0 self-start">
            <CreateKeyDialog onCreate={create} disabled={!!newSecret} />
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <ResourceState {...resource} retry={resource.reload} />
          {!resource.loading &&
            !resource.error &&
            (rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Integration</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice((page - 1) * pageSize, page * pageSize).map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="py-4 pl-6">
                        <p className="max-w-56 truncate font-medium" title={key.name}>
                          {key.name}
                        </p>
                        <code className="text-muted-foreground text-xs">{key.prefix}••••</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <Badge key={scope} variant="secondary">
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(key.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "Never used"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getKeyStatus(key)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1 pr-3">
                          <Button asChild variant="ghost" size="icon">
                            <Link
                              href={`/dashboard/api/usage?keyId=${key.id}`}
                              aria-label={`View usage for ${key.name}`}
                            >
                              <Activity />
                            </Link>
                          </Button>
                          {!key.revokedAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Revoke ${key.name}`}
                              onClick={() => setRevokeTarget(key)}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <KeyRound />
                  </EmptyMedia>
                  <EmptyTitle>Connect your first integration</EmptyTitle>
                  <EmptyDescription>
                    Create a scoped key to read prices, candles, news or your saved resources from another application.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ))}
        </CardContent>
        {rows.length > 0 && (
          <CollectionPagination
            page={page}
            pageSize={pageSize}
            total={rows.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </Card>
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revokeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Applications using this key will lose access immediately. Historical usage will remain available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoking}
              onClick={(event) => {
                event.preventDefault();
                void revoke();
              }}
            >
              {revoking ? "Revoking…" : "Revoke key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
