"use client";

import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { BellRing, CirclePlus, Eye, Pause, Play, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

const conditions = {
  "Price rises above": "PRICE_ABOVE",
  "Price falls below": "PRICE_BELOW",
  "RSI rises above": "RSI_ABOVE",
  "RSI falls below": "RSI_BELOW",
} as const;
const schema = z.object({
  name: z.string().trim().min(1).max(120),
  asset: z.string().min(1),
  condition: z.enum(["Price rises above", "Price falls below", "RSI rises above", "RSI falls below"]),
  threshold: z
    .string()
    .trim()
    .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Enter a valid threshold."),
});
type Draft = z.infer<typeof schema>;
type AlertRecord = {
  id: string;
  name: string;
  assetId: string;
  condition: keyof typeof conditions | string;
  threshold: string | number;
  enabled: boolean;
  createdAt: string;
};
const conditionNames = Object.fromEntries(Object.entries(conditions).map(([label, value]) => [value, label])) as Record<
  string,
  string
>;

export function AlertManager() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<AlertRecord | null>(null);
  const form = useForm<Draft>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", asset: "BTC-USD", condition: "Price rises above", threshold: "" },
  });

  useEffect(() => {
    apiRequest<ApiEnvelope<AlertRecord[]>>("/alerts")
      .then(({ data }) => setAlerts(data))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load alerts."))
      .finally(() => setLoading(false));
  }, []);

  const createAlert = async (draft: Draft) => {
    try {
      const { data } = await apiRequest<ApiEnvelope<AlertRecord>>("/alerts", {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          assetId: draft.asset,
          condition: conditions[draft.condition],
          threshold: Number(draft.threshold),
        }),
      });
      setAlerts((current) => [data, ...current]);
      form.reset();
      setDialogOpen(false);
      toast.success("Alert rule saved. Evaluation is not enabled yet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the alert.");
    }
  };

  const toggle = async (alert: AlertRecord) => {
    try {
      const { data } = await apiRequest<ApiEnvelope<AlertRecord>>(`/alerts/${alert.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !alert.enabled }),
      });
      setAlerts((current) => current.map((item) => (item.id === alert.id ? data : item)));
      toast.success(data.enabled ? "Alert enabled." : "Alert paused.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the alert.");
    }
  };

  const remove = async (id: string) => {
    try {
      await apiRequest(`/alerts/${id}`, { method: "DELETE" });
      setAlerts((current) => current.filter((item) => item.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Alert deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the alert.");
    }
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total rules", alerts.length, "Saved to your account"],
          ["Active", alerts.filter((alert) => alert.enabled).length, "Not evaluated yet"],
          ["Delivery channels", "In-app", "External channels are not connected"],
        ].map(([label, value, caption]) => (
          <Card key={String(label)} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
              <p className="text-xs text-muted-foreground">{caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Alert rules</CardTitle>
            <CardDescription>
              Rules are stored securely; background evaluation and delivery are not implemented.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <CirclePlus /> Create alert
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create alert</DialogTitle>
                <DialogDescription>
                  Save a price or RSI condition to your account. It will not trigger until evaluation is added.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(createAlert)} className="space-y-4">
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="alert-name">Alert name</FieldLabel>
                      <Input {...field} id="alert-name" placeholder="BTC breakout" aria-invalid={fieldState.invalid} />
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="asset"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="alert-asset">Asset symbol</FieldLabel>
                      <Input {...field} id="alert-asset" placeholder="BTC-USD" aria-invalid={fieldState.invalid} />
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="condition"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="alert-condition">Condition</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="alert-condition" aria-invalid={fieldState.invalid}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(conditions).map((label) => (
                            <SelectItem key={label} value={label}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
                <Controller
                  control={form.control}
                  name="threshold"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="alert-threshold">Threshold</FieldLabel>
                      <Input
                        {...field}
                        id="alert-threshold"
                        inputMode="decimal"
                        placeholder="For example, 65000"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Notification channels can be configured after delivery integrations are added.
                </p>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving…" : "Save alert"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground" role="status">
              Loading alerts…
            </p>
          ) : alerts.length === 0 ? (
            <div className="m-4 rounded-lg border border-dashed p-8 text-center sm:m-0">
              <BellRing className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 font-medium">No alert rules</p>
              <p className="mt-1 text-sm text-muted-foreground">Create a rule to save an alert condition.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name and asset</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <span className="font-medium">{alert.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{alert.assetId}</span>
                      </TableCell>
                      <TableCell>{conditionNames[alert.condition] ?? alert.condition}</TableCell>
                      <TableCell className="tabular-nums">{alert.threshold}</TableCell>
                      <TableCell>
                        <Badge variant={alert.enabled ? "default" : "outline"}>
                          {alert.enabled ? "Active" : "Paused"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`View ${alert.name} details`}
                            onClick={() => setSelected(alert)}
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${alert.enabled ? "Pause" : "Activate"} ${alert.name}`}
                            onClick={() => void toggle(alert)}
                          >
                            {alert.enabled ? <Pause /> : <Play />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${alert.name}`}
                            onClick={() => void remove(alert.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 sm:px-6">
          <span className="text-xs text-muted-foreground">Alert evaluation and notifications are not connected.</span>
          <Badge variant="outline">Rules stored</Badge>
        </div>
      </Card>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alert details</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Condition</span>
                <span>
                  {selected.assetId} {conditionNames[selected.condition] ?? selected.condition} {selected.threshold}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">State</span>
                <Badge variant={selected.enabled ? "default" : "outline"}>
                  {selected.enabled ? "Active" : "Paused"}
                </Badge>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">
                Saved in your account. Evaluation and notification delivery have not been implemented.
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
