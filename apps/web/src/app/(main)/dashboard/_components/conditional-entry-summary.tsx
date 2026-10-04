import { describeEntryCondition, type TradeSetup } from "@marketpilot/ai/contracts";

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
  const condition = describeEntryCondition({ ...plan, conditionalEntry: rule }, persian);
  const validity =
    rule.validityBasis === "entry_candle_closes"
      ? text(
          `${rule.validityCandles} future ${plan.interval} closes from proposal`,
          `${rule.validityCandles} بسته‌شدن آیندهٔ کندل ${plan.interval} از زمان پیشنهاد`,
        )
      : text(
          `${rule.validityCandles} × ${plan.interval} elapsed from proposal`,
          `${rule.validityCandles} × ${plan.interval} زمان از لحظهٔ پیشنهاد`,
        );
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
          [text("Entry condition", "شرط ورود"), condition],
          [
            text("Entry deadline", "مهلت دقیق ورود"),
            `${new Date(plan.expiresAt).toLocaleString(persian ? "fa-IR" : undefined)} · ${rule.validityMode === "auto" ? "Auto" : "Manual"} · ${validity}`,
          ],
          [
            text("Invalid before entry", "ابطال پیش از ورود"),
            `${text("Stop touched", "لمس حد ضرر")} · ${plan.direction === "BUY" ? "≤" : "≥"} ${price(rule.invalidation.price)}`,
          ],
          ...(rule.economics
            ? [
                [
                  text("Net reward / risk", "نسبت سود خالص به ریسک"),
                  `${rule.economics.netRewardRisk.toFixed(2)}R · ${text("minimum", "حداقل")} ${rule.economics.minimumNetRewardRisk}R`,
                ],
                [
                  text("Estimated round-trip costs", "برآورد هزینهٔ رفت‌وبرگشت"),
                  `${rule.economics.roundTripCostPercent}% · ${text("user estimate", "برآورد کاربر")}`,
                ],
              ]
            : []),
          [
            text("Indicative position size", "اندازهٔ پیشنهادی پوزیشن"),
            rule.sizing.baseUnits === null
              ? text("Percentage simulation · monetary size unavailable", "شبیه‌سازی درصدی؛ اندازهٔ پولی نامشخص")
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
        {text(
          "Monitoring starts when saved; saving does not restart validity. A confirmation close at the deadline is eligible. Close entries use the actual candle close and repeat economic and capital checks; a touch alone cannot confirm them.",
          "پایش از زمان ثبت شروع می‌شود و ثبت، مهلت را تمدید نمی‌کند. بسته‌شدن دقیقاً در مهلت مجاز است. ورود با close به قیمت واقعی بسته‌شدن و پس از بررسی دوبارهٔ اقتصاد و بودجه انجام می‌شود؛ لمس سطح به‌تنهایی آن را تأیید نمی‌کند.",
        )}
      </p>
      <p className="text-muted-foreground text-xs">
        {news[rule.news.status]}
        {rule.news.latestPublishedAt
          ? ` · ${new Date(rule.news.latestPublishedAt).toLocaleString(persian ? "fa-IR" : undefined)}`
          : ""}{" "}
        · {text("Economic calendar unavailable", "تقویم اقتصادی متصل نیست")}
      </p>
      <p className="text-muted-foreground text-xs">
        {text(
          "Entry expiry affects waiting plans only. The simulation opens and closes automatically from observed candles; estimated round-trip costs are deducted from exits when supplied.",
          "انقضا فقط برای پلنِ منتظر ورود است. شبیه‌سازی با کندل‌های مشاهده‌شده خودکار باز و بسته می‌شود؛ برآورد هزینهٔ رفت‌وبرگشت، در صورت ثبت، از خروج‌ها کسر می‌شود.",
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
          {text("Execution & sizing", "اجرا و اندازهٔ پوزیشن")}
        </summary>
        <div className="mt-2 flex flex-col gap-2 text-muted-foreground text-xs">
          <p>
            {text(
              "Price-based invalidation requires Stop touched before entry; an unmet entry close keeps it waiting until the deadline.",
              "ابطال بر مبنای قیمت، با لمس حد ضرر پیش از ورود رخ می‌دهد؛ close ناموفق صرفاً پلن را تا مهلت در انتظار نگه می‌دارد.",
            )}
          </p>
          <p>{rule.sizing.reason}</p>
        </div>
      </details>
    </div>
  );
}
