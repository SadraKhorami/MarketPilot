"use client";
import { useEffect, useRef, useState } from "react";

import { CreditCard, FlaskConical, RefreshCw } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/hooks/use-api-resource";
import { type ApiEnvelope, ApiError, apiRequest } from "@/lib/api/client";

import { ResourceState } from "../../_components/resource-state";
import { BillingHistory } from "./billing-history";
import { BillingPlans } from "./billing-plans";
import type { BillingOverview } from "./billing-types";
import { BillingUsage } from "./billing-usage";

export function BillingWorkspace() {
  const resource = useApiResource<BillingOverview>("/billing", { keepDataOnReload: true });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"checkout" | "cancel" | null>(null);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [tab, setTab] = useState("overview");
  const requestId = useRef<string | null>(null);
  const data = resource.data;
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") === "cancelled") {
      toast.info("Test checkout cancelled. Your plan has not changed.");
      url.searchParams.delete("checkout");
      window.history.replaceState(null, "", url);
      return;
    }
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) return;
    let mounted = true;
    setBusy(true);
    apiRequest<ApiEnvelope<BillingOverview>>(`/billing/reconcile/${encodeURIComponent(sessionId)}`, { method: "POST" })
      .then(({ data: reconciled }) => {
        if (!mounted) return;
        toast[reconciled.plan === "PRO" ? "success" : "info"](
          reconciled.plan === "PRO"
            ? "Stripe sandbox payment verified. Pro is active."
            : "Your test payment is still pending. Refresh its status shortly.",
        );
        url.searchParams.delete("session_id");
        url.searchParams.delete("checkout");
        window.history.replaceState(null, "", url);
        resource.reload();
      })
      .catch((error: unknown) => {
        if (mounted) setReturnError(error instanceof Error ? error.message : "Could not verify test checkout.");
      })
      .finally(() => {
        if (mounted) setBusy(false);
      });
    return () => {
      mounted = false;
    };
  }, [resource.reload]);

  async function mutate(action: "checkout" | "cancel" | "resume" | "refresh") {
    setBusy(true);
    setReturnError(null);
    try {
      if (action === "checkout") {
        requestId.current ??= crypto.randomUUID();
        const result = await apiRequest<ApiEnvelope<{ url: string | null; status: string }>>("/billing/checkout", {
          method: "POST",
          body: JSON.stringify({ requestId: requestId.current }),
        });
        if (result.data.url) {
          window.location.assign(result.data.url);
          return;
        }
        toast.success("Demo Pro activated for 30 days. No payment was collected.");
        requestId.current = null;
      } else {
        await apiRequest(action === "refresh" ? "/billing/refresh" : "/billing/cancellation", {
          method: "POST",
          ...(action === "refresh" ? {} : { body: JSON.stringify({ cancelAtPeriodEnd: action === "cancel" }) }),
        });
        const messages = {
          refresh: "Test billing status refreshed.",
          cancel: "Pro will end after the current period.",
          resume: "Cancellation removed. Pro remains active.",
        };
        toast.success(messages[action]);
      }
      resource.reload();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) requestId.current = null;
      setReturnError(error instanceof Error ? error.message : "Could not update test billing.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const canExplore =
    data?.plan === "FREE" &&
    (!data.subscription || ["free", "canceled", "incomplete_expired", "expired"].includes(data.subscription.status));
  let planDescription =
    "Markets, news and technical analysis are included. Pro expands your research and monitoring allowances.";
  if (data?.plan === "PRO")
    planDescription = "Your expanded allowances are active. Review usage below to see what remains.";
  if (data?.subscription?.cancelAtPeriodEnd) {
    planDescription =
      "Cancellation is scheduled. Free allowances apply while this subscription is inactive. Your saved data is kept.";
    if (data.plan === "PRO")
      planDescription =
        "Cancellation is scheduled. Pro benefits continue until the period ends, then Free limits apply. Your saved data is kept.";
  }
  const confirmation = confirmationCopy(confirm, data?.mode);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Alert>
        <FlaskConical />
        <AlertTitle>Test billing only</AlertTitle>
        <AlertDescription>
          Explore subscriptions with demo or Stripe sandbox payments. No real money is collected. Live payments are
          disabled.
        </AlertDescription>
      </Alert>
      <ResourceState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {returnError && (
        <ResourceState
          loading={false}
          error={returnError}
          retry={() => void mutate("refresh")}
          title="Could not update test billing"
        />
      )}
      {data && !resource.error && (
        <Tabs value={tab} onValueChange={setTab} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="plans">Plans</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <Badge variant="outline">
              {{ stripe_test: "Stripe sandbox", demo: "Demo environment", disabled: "Billing disabled" }[data.mode]}
            </Badge>
          </div>
          <TabsContent value="overview" className="flex flex-col gap-4">
            <Card>
              <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-col gap-2">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <CreditCard className="size-4" />
                    {data.plans[data.plan].name} plan
                    <Badge variant="secondary">{data.subscription?.status ?? "free"}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {data.plan === "PRO" && data.subscription?.currentPeriodEnd
                      ? `${data.subscription.cancelAtPeriodEnd || data.subscription.provider === "DEMO" ? "Ends" : "Next test renewal"} ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}`
                      : "Your Free allowance is ready to use."}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {data.mode === "stripe_test" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void mutate("refresh")}>
                      <RefreshCw data-icon="inline-start" />
                      Refresh status
                    </Button>
                  )}
                  {canExplore && (
                    <Button size="sm" onClick={() => setTab("plans")}>
                      Explore Pro
                    </Button>
                  )}
                  {!canExplore && data.subscription?.cancelAtPeriodEnd && (
                    <Button size="sm" disabled={busy} onClick={() => void mutate("resume")}>
                      Keep Pro
                    </Button>
                  )}
                  {!canExplore && !data.subscription?.cancelAtPeriodEnd && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("cancel")}>
                      Cancel Pro
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{planDescription}</p>
              </CardContent>
            </Card>
            <BillingUsage data={data} />
          </TabsContent>
          <TabsContent value="plans">
            <BillingPlans data={data} busy={busy} checkout={() => setConfirm("checkout")} />
          </TabsContent>
          <TabsContent value="history">
            <BillingHistory />
          </TabsContent>
        </Tabs>
      )}
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (confirm) void mutate(confirm);
              }}
            >
              {busy ? "Please wait…" : confirmation.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function confirmationCopy(action: "checkout" | "cancel" | null, mode?: BillingOverview["mode"]) {
  if (action === "cancel")
    return {
      title: "End Pro after this period?",
      description:
        "Pro remains active through the current period. Afterward, Free limits apply. Saved watchlists, alerts and history are kept; Telegram and Discord alert delivery requires Pro.",
      action: "Schedule cancellation",
    };
  if (mode === "demo")
    return {
      title: "Activate demo Pro?",
      description: "This activates Pro for 30 days without payment. It does not renew automatically.",
      action: "Continue",
    };
  return {
    title: "Open Stripe test checkout?",
    description:
      "You will open Stripe's sandbox checkout. Use a Stripe test card, not a real card. The displayed monthly amount is a test price; no real money is charged.",
    action: "Continue",
  };
}
