import type { TradeSetup } from "@marketpilot/ai/contracts";
import { Badge } from "@/components/ui/badge";

export function ConditionalEntrySummary({ plan, persian = false }: { plan: TradeSetup; persian?: boolean }) {
  const rule = plan.conditionalEntry;
  const text = (en: string, fa: string) => (persian ? fa : en);
  if (!rule)
    return (
      <p className="text-muted-foreground text-xs">
        {text(
          "Legacy plan · original entry rule and validity retained.",
          "پلن قدیمی؛ شرط ورود و اعتبار قبلی حفظ شده است.",
        )}
      </p>
    );
  const scenarios = { breakout: text("Breakout", "شکست"), pullback: text("Pullback", "پولبک") };
  const conditions = {
    touch: text("Touch Entry", "لمس ورود"),
    candle_close: text(
      plan.direction === "BUY" ? "Candle closes above Entry" : "Candle closes below Entry",
      plan.direction === "BUY" ? "بسته‌شدن کندل بالای ورود" : "بسته‌شدن کندل زیر ورود",
    ),
    break_retest: text(
      "Completed break, then a later retest candle closing on the breakout side",
      "شکست در کندل بسته‌شده، سپس بازآزمایی در کندل بعدی با بسته‌شدن در سمت شکست",
    ),
  };
  if (rule.scenario === "pullback") {
    conditions.candle_close = text(
      plan.direction === "BUY" ? "Retest Entry, then close above it" : "Retest Entry, then close below it",
      plan.direction === "BUY"
        ? "بازگشت به ورود، سپس بسته‌شدن کندل بالای آن"
        : "بازگشت به ورود، سپس بسته‌شدن کندل زیر آن",
    );
    conditions.touch = text("Retest Entry after the observed break", "بازآزمایی ورود پس از شکست مشاهده‌شده");
  }
  const news = {
    available: text("Stored news available", "خبر ذخیره‌شده موجود"),
    stale: text("Stored news stale", "خبر ذخیره‌شده قدیمی"),
    unavailable: text("Relevant news unavailable", "خبر مرتبط ناموجود"),
  };
  const price = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${plan.quote}`;
  return (
    <div className="flex min-w-0 flex-col gap-3" dir={persian ? "rtl" : undefined}>
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{scenarios[rule.scenario]}</Badge>
        <Badge variant="outline">
          {rule.timeframeMode === "auto" ? "Auto" : "Manual"} · {plan.interval} / {rule.trendInterval}
        </Badge>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        {[
          [text("Entry condition", "شرط ورود"), conditions[rule.condition]],
          [
            text("Entry deadline", "مهلت دقیق ورود"),
            `${new Date(plan.expiresAt).toLocaleString(persian ? "fa-IR" : undefined)} · ${rule.validityMode === "auto" ? "Auto" : "Manual"} · ${rule.validityCandles} ${text("entry candles", "کندل ورود")}`,
          ],
          [
            text("Invalid before entry", "ابطال پیش از ورود"),
            `${plan.direction === "BUY" ? "≤" : "≥"} ${price(rule.invalidation.price)}`,
          ],
          [
            text("Indicative position size", "اندازهٔ پیشنهادی پوزیشن"),
            rule.sizing.baseUnits === null
              ? text("Percentage simulation · capital not supplied", "شبیه‌سازی درصدی؛ سرمایه وارد نشده")
              : `${rule.sizing.baseUnits.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${plan.symbol.split("-")[0]} · ${text("risk budget", "بودجهٔ ریسک")} ${rule.sizing.riskAmount?.toLocaleString()} ${plan.quote}`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="mt-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground text-xs">
        {news[rule.news.status]}
        {rule.news.latestPublishedAt
          ? ` · ${new Date(rule.news.latestPublishedAt).toLocaleString(persian ? "fa-IR" : undefined)}`
          : ""}{" "}
        · {text("Economic calendar unavailable", "تقویم اقتصادی متصل نیست")}
      </p>
      <p className="text-muted-foreground text-xs">
        {text(
          "Entry expiry affects waiting plans only. The simulation opens and closes automatically from observed candles; fees are zero unless supplied.",
          "انقضا فقط برای پلنِ منتظر ورود است. شبیه‌سازی با کندل‌های مشاهده‌شده خودکار باز و بسته می‌شود؛ هزینه‌ها در صورت ثبت‌نشدن صفر هستند.",
        )}
      </p>
      {rule.openRisk ? (
        <p className="text-muted-foreground text-xs">
          {text("Journal risk at stored stops", "ریسک Journal بر مبنای حد ضرر ثبت‌شده")}:{" "}
          {rule.openRisk.knownAmount === null ? text("unknown", "نامشخص") : price(rule.openRisk.knownAmount)} ·{" "}
          {rule.openRisk.knownTrades} {text("known", "معلوم")} / {rule.openRisk.unknownTrades}{" "}
          {text("unknown positions", "پوزیشن نامعلوم")} ·{" "}
          {text("Based on journal positions only", "فقط پوزیشن‌های ثبت‌شده در جورنال")}
        </p>
      ) : null}
      <details>
        <summary className="cursor-pointer text-muted-foreground text-xs">
          {text("Proposal & validity reasons", "دلیل پیشنهاد و اعتبار")}
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-muted-foreground text-xs">
          <p>{rule.rationale}</p>
          <p>{rule.validityReason}</p>
          <p>{rule.sizing.reason}</p>
        </div>
      </details>
    </div>
  );
}
