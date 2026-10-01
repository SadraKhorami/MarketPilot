"use client";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { BotState, LinkToken, Provider } from "./bot-types";

export function BotLinkPanel({
  provider,
  state,
  token,
  busy,
  now,
  action,
}: {
  provider: Provider;
  state: BotState;
  token: LinkToken | null;
  busy: boolean;
  now: number;
  action: (operation: "link" | "confirm" | "disconnect") => void;
}) {
  const candidate = state.candidate && Date.parse(state.candidate.expiresAt) > now ? state.candidate : null;
  const validToken = token && Date.parse(token.expiresAt) > now ? token : null;
  if (state.channel?.active) return null;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Link your account</CardTitle>
        <CardDescription>
          Complete the private platform step, then verify the account here. Links expire after ten minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <ol className="flex min-w-0 flex-col gap-4">
          {[
            {
              title: provider === "telegram" ? "Open the bot" : "Open a private DM",
              description:
                provider === "telegram"
                  ? "Create your secure link, open Telegram and press Start in the bot chat."
                  : "Install MarketPilot. Click its profile and choose Message. In that private DM, select the /link slash command and paste your code into its code field.",
            },
            {
              title: "Confirm your account",
              description:
                "Return here and check the account name and ID before confirming. Reject any identity you do not recognize.",
            },
            {
              title: "Choose your notifications",
              description:
                "Research commands are ready after confirmation. Turn on market alerts here whenever you want.",
            },
          ].map((step, index) => (
            <li key={step.title} className="flex min-w-0 items-start gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-muted font-medium text-xs"
                aria-hidden="true"
              >
                {index === 0 && candidate ? <Check className="size-3.5" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="mt-1 text-muted-foreground text-sm">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
        {candidate ? (
          <Alert>
            <AlertTitle>Confirm this platform identity</AlertTitle>
            <AlertDescription>
              <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="min-w-0 flex-1 break-all">
                  {candidate.candidateName ?? "Platform account"} · {candidate.candidateId}
                  <br />
                  Expires {new Date(candidate.expiresAt).toLocaleTimeString()}
                </p>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => action("confirm")}>
                    Confirm account
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => action("disconnect")}>
                    Reject
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
        {validToken && !candidate ? (
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border p-4">
            {!validToken.url ? (
              <p className="text-sm">
                In Discord, click MarketPilot → Message. Type /link, select the bot’s command, then paste this code into
                the code field. A regular message in #general will not link your account.
              </p>
            ) : null}
            {validToken.url ? (
              <Button className="self-start" asChild>
                <a href={validToken.url} rel="noreferrer" referrerPolicy="no-referrer">
                  <ExternalLink data-icon="inline-start" />
                  Open Telegram bot
                </a>
              </Button>
            ) : (
              <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <code className="min-w-0 flex-1 break-all rounded-md bg-muted p-3 text-sm">{validToken.code}</code>
                <Button
                  className="shrink-0"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(validToken.code ?? "")
                      .then(() => toast.success("Link code copied."))
                      .catch(() => toast.error("Could not copy. Select the command manually."));
                  }}
                >
                  <Copy data-icon="inline-start" />
                  Copy code
                </Button>
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              Expires {new Date(validToken.expiresAt).toLocaleTimeString()} · Keep this link or code private. Waiting
              for your platform identity…
            </p>
            <Button className="self-start" variant="outline" disabled={busy} onClick={() => action("disconnect")}>
              Cancel link
            </Button>
          </div>
        ) : null}
        {!validToken && !candidate ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            {state.installUrl ? (
              <Button variant="outline" asChild>
                <a href={state.installUrl} rel="noreferrer" referrerPolicy="no-referrer">
                  <ExternalLink data-icon="inline-start" />
                  Install Discord bot
                </a>
              </Button>
            ) : null}
            <Button disabled={busy || !state.configuration.configured} onClick={() => action("link")}>
              {token ? "Create a new link" : "Create secure link"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
