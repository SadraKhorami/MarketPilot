import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { Provider } from "./bot-types";

export function BotCommands({ provider }: { provider: Provider }) {
  const discord = provider === "discord";
  const commands = [
    { title: "Quick help", command: "/help", description: "See the available commands and account-linking guidance." },
    {
      title: "Market snapshot",
      command: discord ? "/market symbol:BTC" : "/price BTC",
      description: "Check an observed price, source freshness and available technical indicators.",
    },
    {
      title: "Asset research",
      command: discord ? "/analyze symbol:XAU-USD" : "/analyze XAU-USD",
      description: "Request sourced AI research for a market in the MarketPilot catalog.",
    },
    {
      title: "Ask a question",
      command: discord ? "/ask question:What is the trend for BTC?" : "/ask What is the trend for BTC?",
      description: "Research a specific question using your account’s existing research allowance.",
    },
    {
      title: "Your watchlists",
      command: discord ? "/watchlist page:1" : "/watchlist 1",
      description: "Review your saved watchlists. Change the page number to see more.",
    },
    {
      title: "Your alert rules",
      command: discord ? "/alerts page:1" : "/alerts 1",
      description: "Review your saved rules and their status. Manage them in the dashboard.",
    },
  ];
  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Start a conversation</CardTitle>
          <CardDescription>
            {discord
              ? "Use the bot’s slash-command menu and fill in the named fields. Link your account in a private DM."
              : "Send these commands to the MarketPilot bot in a private Telegram chat. You can also send a research question as a text message."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Confirm your account in the Connection tab to access research, watchlists and alert rules.
          </p>
        </CardContent>
      </Card>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {commands.map((command) => (
          <Card key={command.title} className="min-w-0">
            <CardHeader>
              <CardTitle>{command.title}</CardTitle>
              <CardDescription>{command.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <code className="block whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-sm">
                {command.command}
              </code>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">Review AI proposals in your dashboard</p>
            <p className="mt-1 text-muted-foreground text-sm">
              Confirm proposed alert rules in AI Analyst. Bot commands do not execute trades.
            </p>
          </div>
          <Button className="shrink-0 self-start" variant="outline" asChild>
            <Link href="/dashboard/ai-analyst">
              Open AI Analyst
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
