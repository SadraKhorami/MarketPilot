"use client";

import type { ResearchResult } from "@marketpilot/ai/contracts";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { MessageHeader } from "@/components/ui/message";
import { AlertProposal } from "./alert-proposal";
import { ResearchSources } from "./research-sources";
import { toolLabels } from "./research-stream";
import { TradeScenario } from "./trade-scenario";

export function ResearchResponse({
  result,
  change,
  persian,
  edit,
}: {
  result: ResearchResult;
  change: (result: ResearchResult) => void;
  persian: boolean;
  edit?: () => void;
}) {
  const text = (en: string, fa: string) => (persian ? fa : en);
  const summary = result.answer.interpretation[0];
  const setup = result.tools.findLast((tool) => tool.tool === "getTradeSetup");
  const noSetupReason =
    setup?.reason ?? result.sources.find((source) => source.kind === "market" && source.error)?.error;
  return (
    <>
      <MessageHeader>MarketPilot · {text("Research", "تحلیل")}</MessageHeader>
      {!result.tradeSetup && setup ? (
        <div className="flex flex-col gap-1" dir={persian ? "rtl" : undefined}>
          <p className="text-sm font-medium">{text("No valid entry setup", "فعلاً سناریوی ورود معتبر موجود نیست")}</p>
          {noSetupReason ? <p className="text-sm text-muted-foreground">{noSetupReason}</p> : null}
        </div>
      ) : null}
      {result.tradeSetup ? (
        <TradeScenario plan={result.tradeSetup} result={result} change={change} persian={persian} edit={edit} />
      ) : summary ? (
        <Bubble variant="ghost">
          <BubbleContent className="whitespace-pre-wrap leading-relaxed" dir={persian ? "rtl" : undefined}>
            {summary.text}
          </BubbleContent>
        </Bubble>
      ) : null}
      {result.proposals
        .filter(
          (proposal) =>
            !(
              result.tradeSetup &&
              proposal.state === "confirmed" &&
              proposal.interval === "1m" &&
              proposal.symbol === result.tradeSetup.symbol
            ),
        )
        .map((proposal) => (
          <AlertProposal
            key={proposal.id}
            proposal={proposal}
            change={(updated) =>
              change({
                ...result,
                proposals: result.proposals.map((item) => (item.id === updated.id ? updated : item)),
              })
            }
          />
        ))}
      <details className="group border-b pb-3" dir={persian ? "rtl" : undefined}>
        <summary className="cursor-pointer rounded-md py-2 text-sm font-medium focus-visible:outline-ring">
          {text("Analysis & sources", "تحلیل و منابع")} · {result.sources.length}{" "}
          {text(result.sources.length === 1 ? "source" : "sources", "منبع")}
        </summary>
        <div className="mt-3 flex min-w-0 flex-col gap-4">
          {result.answer.interpretation.slice(result.tradeSetup ? 0 : 1).map((item, index) => (
            <div key={item.text} className="flex flex-col gap-1">
              <h3 className="font-medium text-sm">
                {[
                  text("Summary", "خلاصه"),
                  text("Technical analysis", "تحلیل تکنیکال"),
                  text("Context & limitations", "شرایط و محدودیت‌ها"),
                ][index + (result.tradeSetup ? 0 : 1)] ?? text("Additional analysis", "تحلیل تکمیلی")}
              </h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.text}</p>
              {item.sourceIds.length ? (
                <p className="text-muted-foreground text-xs">
                  {text("Sources", "منابع")}:{" "}
                  {[
                    ...new Set(
                      item.sourceIds.map((id) => result.sources.find((s) => s.id === id)?.title).filter(Boolean),
                    ),
                  ].join(" · ")}
                </p>
              ) : null}
            </div>
          ))}
          <ResearchSources sources={result.sources} />
          <details>
            <summary className="cursor-pointer text-muted-foreground text-xs">
              {text("Research activity", "روند بررسی")} · {result.tools.length} {text("lookups", "بررسی")}
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-muted-foreground text-xs">
              {result.tools.map((tool) => (
                <li key={tool.id}>
                  {toolLabels[tool.tool]} ·{" "}
                  {tool.outcome === "no_setup"
                    ? text("No valid setup", "پلن معتبر موجود نیست")
                    : tool.outcome === "ready"
                      ? text("Plan ready", "پلن آماده")
                      : tool.status}{" "}
                  · {tool.latencyMs} ms
                  {tool.reason ? ` · ${tool.reason}` : ""}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </details>
    </>
  );
}
