"use client";

import { useState } from "react";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

export function CreateWatchlist({
  onCreated,
  disabled,
}: {
  onCreated: (list: { id: string; name: string }) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const { data } = await apiRequest<ApiEnvelope<{ id: string; name: string }>>("/watchlists", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      onCreated(data);
      setOpen(false);
      toast.success(`${data.name} created. Add your first market.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the watchlist.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          if (next) {
            setName("");
            setError(null);
          }
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <FolderPlus data-icon="inline-start" />
          New watchlist
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a watchlist</DialogTitle>
          <DialogDescription>Keep related markets together, for example Crypto or Forex.</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="new-watchlist-name">Name</FieldLabel>
              <Input
                id="new-watchlist-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="e.g. Crypto"
                disabled={pending}
                aria-invalid={!!error}
                aria-describedby={error ? "new-watchlist-error" : undefined}
                required
              />
            </Field>
          </FieldGroup>
          {error ? (
            <p id="new-watchlist-error" role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || pending}>
              {pending ? "Creating…" : "Create watchlist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
