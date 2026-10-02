"use client";
import { useState } from "react";

import type { Proposal } from "@marketpilot/ai/contracts";
import { Bell } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

const conditionNames = {
  PRICE_ABOVE: "Price above",
  PRICE_BELOW: "Price below",
  RSI_ABOVE: "RSI above",
  RSI_BELOW: "RSI below",
};
export function AlertProposal({ proposal, change }: { proposal: Proposal; change: (proposal: Proposal) => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expired = Date.parse(proposal.expiresAt) <= Date.now();
  async function decide(decision: "confirm" | "cancel") {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiRequest<ApiEnvelope<Proposal>>(`/ai/proposals/${proposal.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ runId: proposal.runId, decision }),
      });
      change(response.data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "This proposal could not be updated.");
    } finally {
      setPending(false);
    }
  }
  const pendingLabel = expired ? "Expired" : "Awaiting confirmation";
  const stateLabel =
    proposal.state === "pending" ? pendingLabel : { confirmed: "Saved", cancelled: "Cancelled" }[proposal.state];
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" />
          Review alert rule
        </CardTitle>
        <CardDescription>
          {proposal.symbol} · {conditionNames[proposal.condition]} {proposal.threshold.toLocaleString()}{" "}
          {proposal.condition.startsWith("RSI") ? "index" : proposal.symbol.split("-")[1]}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Badge variant="outline">{stateLabel}</Badge>
        <p className="text-muted-foreground text-xs">
          {proposal.state === "confirmed" ? "Saved rule" : "Confirm to activate a rule"} · {proposal.interval ?? "15m"}{" "}
          observations with dashboard inbox delivery. The first observation sets its baseline; later crossings can
          trigger a notification, subject to your in-app preferences.
        </p>
        {proposal.state === "pending" ? (
          <p className="text-muted-foreground text-xs">
            Expires {new Date(proposal.expiresAt).toLocaleString()} · Cooldown 60 minutes
          </p>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not update proposal</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      {proposal.state === "pending" ? (
        <CardFooter className="flex flex-wrap gap-2">
          <Button size="sm" disabled={pending || expired} onClick={() => decide("confirm")}>
            {pending ? "Saving…" : "Confirm and save rule"}
          </Button>
          <Button size="sm" variant="outline" disabled={pending || expired} onClick={() => decide("cancel")}>
            Cancel
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
