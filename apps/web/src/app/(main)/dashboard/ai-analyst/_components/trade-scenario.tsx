"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { Proposal, ResearchResult, TradeSetup } from "@marketpilot/ai/contracts";
import { BellPlus, LoaderCircle, Target } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type ApiEnvelope, apiRequest } from "@/lib/api/client";

export function TradeScenario({
  plan,
  result,
  change,
  persian,
}: {
  plan: TradeSetup;
  result: ResearchResult;
  change: (result: ResearchResult) => void;
  persian: boolean;
}) {
  const id = useId();
  const unit = plan.pipSize ? "pips" : "quote";
  const scale = plan.pipSize ?? 1;
  const decimals = plan.pipSize === 0.0001 ? 5 : plan.quote === "JPY" ? 3 : plan.quote === "USD" ? 2 : 8;
  const gap = plan.direction === "BUY" ? plan.entry - plan.observedPrice : plan.observedPrice - plan.entry;
  const initial = Math.min(Math.abs(plan.entry - plan.stopLoss) * 0.1, Math.max(0, gap) * 0.25) / scale;
  const [distance, setDistance] = useState(
    initial > 0 ? String(Number(initial.toFixed(plan.pipSize ? 2 : decimals))) : "",
  );
  const [pending, setPending] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const expired = Date.parse(plan.expiresAt) <= now;
  const amount = Number(distance);
  const offset = amount * scale;
  const threshold = Number((plan.entry + (plan.direction === "BUY" ? -offset : offset)).toFixed(decimals));
  const valid =
    Number.isFinite(amount) &&
    amount > 0 &&
    amount <= 1000000 &&
    offset < Math.abs(plan.entry - plan.stopLoss) &&
    offset < gap &&
    threshold !== plan.entry;
  const saved = result.proposals.find(
    (proposal) => proposal.state === "confirmed" && proposal.interval === "1m" && proposal.symbol === plan.symbol,
  );
  const text = (en: string, fa: string) => (persian ? fa : en);
  const price = (value: number) =>
    `${value.toLocaleString(undefined, { maximumFractionDigits: decimals })} ${plan.quote}`;
  const stages = {
    waiting_pullback: text("Waiting for pullback", "در انتظار اصلاح قیمت"),
    waiting_reclaim: text("Waiting for a completed-candle breakout", "در انتظار تأیید شکست با بسته‌شدن کندل"),
    confirmed: text("Candle breakout observed", "شکست در کندل بسته‌شده مشاهده شد"),
  };
  async function save() {
    if (pending || !valid || expired || saved) return;
    setPending(true);
    setError(null);
    try {
      const response = await apiRequest<ApiEnvelope<Proposal>>(`/ai/runs/${result.runId}/entry-alert`, {
        method: "POST",
        body: JSON.stringify({ distance: amount, unit, confirm: true }),
      });
      change({ ...result, proposals: [response.data] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : text("Could not save this alert.", "ثبت هشدار انجام نشد."));
    } finally {
      setPending(false);
    }
  }
  const offerAlert = !saved && !declined && !expired && !result.proposals.length;
  return (
    <Card size="sm" dir={persian ? "rtl" : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Target className="size-4" />
          {plan.symbol}
          <Badge variant="outline">{plan.direction}</Badge>
          <span className="text-muted-foreground text-xs">{plan.interval}</span>
        </CardTitle>
        <CardDescription>
          {expired
            ? text("Expired — request a fresh scenario", "منقضی شده؛ سناریوی جدید درخواست کنید")
            : stages[plan.stage]}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [text("Entry trigger", "شرط ورود"), plan.entry],
            [text("Stop loss", "حد ضرر"), plan.stopLoss],
            ["TP 1 · 1R", plan.targets[0]],
            ["TP 2 · 2R", plan.targets[1]],
          ].map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col gap-1">
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="break-words font-medium text-sm tabular-nums" dir="ltr">
                {price(Number(value))}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-sm leading-relaxed">
          {plan.direction === "BUY"
            ? text(
                "BUY only after a pullback and a completed candle above Entry. Below Stop loss, the scenario is invalid.",
                "ورود BUY فقط بعد از اصلاح و بسته‌شدن کندل بالای Entry بررسی شود. زیر حد ضرر، سناریو باطل است.",
              )
            : text(
                "SELL only after an upward pullback and a completed candle below Entry. Above Stop loss, the scenario is invalid.",
                "ورود SELL فقط بعد از اصلاح صعودی و بسته‌شدن کندل زیر Entry بررسی شود. بالای حد ضرر، سناریو باطل است.",
              )}
        </p>
        <p className="text-muted-foreground text-xs">
          {text("Observed price", "قیمت مشاهده‌شده")}:{" "}
          <span dir="ltr" className="tabular-nums">
            {price(plan.observedPrice)}
          </span>{" "}
          · {new Date(plan.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <details>
          <summary className="cursor-pointer text-muted-foreground text-xs">
            {text("Calculation & alert timing", "محاسبات و زمان‌بندی هشدار")}
          </summary>
          <div className="mt-2 flex flex-col gap-2 text-muted-foreground text-xs leading-relaxed">
            <p>
              {text(
                "Entry uses the previous candle range. Stop loss uses recent swing extremes and an ATR buffer. Targets are 1R and 2R, not price predictions; fees, spread and slippage are excluded.",
                "ورود بر اساس محدودهٔ کندل‌های قبلی، حد ضرر بر اساس اکسترمم اصلاح اخیر و حاشیهٔ ATR است. تارگت‌ها ۱ و ۲ برابر ریسک هستند، نه پیش‌بینی قیمت؛ کارمزد، اسپرد و لغزش لحاظ نشده‌اند.",
              )}
            </p>
            <p>
              {text(
                "Alerts use one-minute observations. The first observation sets a baseline; later crossings trigger. This does not confirm the entry conditions or guarantee tick-level timing.",
                "هشدار با دادهٔ یک‌دقیقه‌ای بررسی می‌شود. اولین مشاهده مبناست و عبورهای بعدی هشدار می‌دهند؛ این هشدار تأیید شرایط ورود یا تضمین زمان‌بندی لحظه‌ای نیست.",
              )}
            </p>
            {plan.pipSize ? (
              <p>
                1 pip = {plan.pipSize} {plan.quote}
              </p>
            ) : null}
            <p>
              {text("Observed", "زمان مشاهده")}: {new Date(plan.observedAt).toLocaleString()}
            </p>
          </div>
        </details>
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{text("Alert not saved", "هشدار ثبت نشد")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
      {offerAlert ? (
        <CardFooter className="flex flex-col items-stretch gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <p className="flex items-center gap-2 font-medium text-sm">
                <BellPlus className="size-4" />
                {text("Alert me before Entry?", "قبل از رسیدن به ورود، هشدار بده؟")}
              </p>
              <p className="text-muted-foreground text-xs">{text("Alert trigger price", "قیمت فعال‌شدن هشدار")}</p>
            </div>
            <output htmlFor={id} className="font-semibold text-lg tabular-nums" dir="ltr">
              {valid ? `${price(threshold)} ${plan.direction === "BUY" ? "↑" : "↓"}` : "—"}
            </output>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field className="w-auto min-w-0 flex-1">
              <FieldLabel htmlFor={id}>{text("Distance before Entry", "فاصله تا قیمت ورود")}</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={distance}
                  disabled={pending}
                  onChange={(event) => setDistance(event.target.value)}
                  aria-invalid={distance !== "" && !valid}
                  aria-describedby={`${id}-help`}
                  className="w-28"
                />
                <span className="text-muted-foreground text-sm">{plan.pipSize ? text("pips", "پیپ") : plan.quote}</span>
              </div>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={pending || !valid} onClick={save}>
                {pending ? (
                  <LoaderCircle data-icon="inline-start" className="animate-spin" />
                ) : (
                  <BellPlus data-icon="inline-start" />
                )}
                {pending ? text("Saving…", "در حال ثبت…") : text("Yes, create alert", "بله، ثبت هشدار")}
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDeclined(true)}>
                {text("Not now", "فعلاً نه")}
              </Button>
            </div>
          </div>
          <FieldDescription id={`${id}-help`}>
            {valid
              ? text(
                  `${distance} ${plan.pipSize ? "pips" : plan.quote} is the warning distance, not the asset price.`,
                  `${distance} ${plan.pipSize ? "پیپ" : plan.quote} فاصلهٔ هشدار تا ورود است؛ قیمت هشدار بالاتر نمایش داده شده.`,
                )
              : text(
                  "Choose a positive distance smaller than the current gap to Entry.",
                  "فاصله‌ای مثبت و کمتر از فاصلهٔ قیمت فعلی تا ورود انتخاب کنید.",
                )}
          </FieldDescription>
        </CardFooter>
      ) : saved ? (
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <p role="status" className="text-sm">
            {text("Alert saved at", "هشدار ثبت شد در قیمت")} <span dir="ltr">{price(saved.threshold)}</span>
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/alerts">{text("Manage alerts", "مدیریت هشدارها")}</Link>
          </Button>
        </CardFooter>
      ) : declined && !expired ? (
        <CardFooter>
          <Button size="sm" variant="ghost" onClick={() => setDeclined(false)}>
            {text("Set an entry alert", "تنظیم هشدار ورود")}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
