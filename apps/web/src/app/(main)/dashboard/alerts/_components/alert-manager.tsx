"use client";

import { useState } from "react";

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
import { type DemoAlert, demoAlerts, demoAssets } from "@/data/marketpilot";

import { FixtureNote, StatusBadge } from "../../_components/marketpilot-page";

const alertSchema = z.object({
  asset: z.string().min(1, "Choose an asset."),
  condition: z.enum(["Price rises above", "Price falls below", "RSI rises above", "RSI falls below"]),
  threshold: z
    .string()
    .trim()
    .min(1, "Enter a threshold.")
    .refine((value) => Number.isFinite(Number(value)) && Number(value) > 0, "Enter a positive number."),
  channel: z.enum(["Dashboard", "Telegram · demo", "Discord · demo"]),
});

type AlertDraft = z.infer<typeof alertSchema>;

export function AlertManager() {
  const [alerts, setAlerts] = useState<DemoAlert[]>(demoAlerts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<DemoAlert | null>(null);
  const form = useForm<AlertDraft>({
    resolver: zodResolver(alertSchema),
    defaultValues: { asset: "BTC", condition: "Price rises above", threshold: "", channel: "Dashboard" },
  });

  const createAlert = (draft: AlertDraft) => {
    const nextAlert: DemoAlert = {
      ...draft,
      id: `AL-DEMO-${alerts.length + 1}`,
      status: "Active",
      updatedAt: "Just now",
    };
    setAlerts((current) => [nextAlert, ...current]);
    form.reset();
    setDialogOpen(false);
    toast.success("Alert added to temporary page state. It will not be evaluated.");
  };

  const toggleAlert = (id: string) =>
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === id ? { ...alert, status: alert.status === "Active" ? "Paused" : "Active" } : alert,
      ),
    );
  const removeAlert = (id: string) => {
    setAlerts((current) => current.filter((alert) => alert.id !== id));
    toast.info("Example alert removed from this page only.");
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total rules", `${alerts.length}`, "Local examples"],
          ["Active", `${alerts.filter((alert) => alert.status === "Active").length}`, "Not evaluated"],
          ["Delivery channels", "3", "Preview options"],
        ].map(([label, value, caption]) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">{label}</p>
              <p className="mt-2 font-semibold text-2xl">{value}</p>
              <p className="text-muted-foreground text-xs">{caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Alert rules</CardTitle>
            <CardDescription>Example conditions · local state only</CardDescription>
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
                  Preview the alert form. Saving only updates this page; rules are not persisted or evaluated.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(createAlert)} className="space-y-4">
                <Controller
                  control={form.control}
                  name="asset"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="alert-asset">Asset</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="alert-asset" aria-invalid={fieldState.invalid}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {demoAssets.map((asset) => (
                            <SelectItem key={asset.symbol} value={asset.symbol}>
                              {asset.symbol} · {asset.name}
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
                  name="condition"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="alert-condition">Condition</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="alert-condition" aria-invalid={fieldState.invalid}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Price rises above", "Price falls below", "RSI rises above", "RSI falls below"].map(
                            (condition) => (
                              <SelectItem key={condition} value={condition}>
                                {condition}
                              </SelectItem>
                            ),
                          )}
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
                <Controller
                  control={form.control}
                  name="channel"
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="alert-channel">Notification channel</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="alert-channel" aria-invalid={fieldState.invalid}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dashboard">Dashboard</SelectItem>
                          <SelectItem value="Telegram · demo">Telegram · demo</SelectItem>
                          <SelectItem value="Discord · demo">Discord · demo</SelectItem>
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
                  <Button type="submit">Add preview rule</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          {alerts.length === 0 ? (
            <div className="m-4 rounded-lg border border-dashed p-8 text-center sm:m-0">
              <BellRing className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 font-medium">No alert rules</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Create a local preview rule to see its condition and channel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <span className="font-medium">{alert.asset}</span>
                        <span className="ml-2 text-muted-foreground text-xs">{alert.id}</span>
                      </TableCell>
                      <TableCell>{alert.condition}</TableCell>
                      <TableCell className="tabular-nums">{alert.threshold}</TableCell>
                      <TableCell>{alert.channel}</TableCell>
                      <TableCell>
                        <StatusBadge value={alert.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelected(alert)}
                            aria-label={`View ${alert.id} details`}
                          >
                            <Eye />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleAlert(alert.id)}
                            aria-label={`${alert.status === "Active" ? "Pause" : "Activate"} ${alert.id}`}
                          >
                            {alert.status === "Active" ? <Pause /> : <Play />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAlert(alert.id)}
                            aria-label={`Remove ${alert.id}`}
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
          <FixtureNote>Preview rules are not evaluated or delivered.</FixtureNote>
          <Badge variant="outline">Service disconnected</Badge>
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
            <DialogDescription>{selected?.id} · example rule</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Condition</span>
                <span>
                  {selected.asset} {selected.condition.toLowerCase()} {selected.threshold}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Delivery</span>
                <span>{selected.channel}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge value={selected.status} />
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground">
                This rule is stored only in temporary page state. It has not been evaluated.
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
