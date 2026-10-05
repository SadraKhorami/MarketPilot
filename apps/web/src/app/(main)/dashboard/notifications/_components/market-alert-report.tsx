import type { MarketAlertReport } from "./notification-types";

export function alertMetric(report: MarketAlertReport) {
  return report.condition.startsWith("PRICE_")
    ? "Price"
    : report.condition.startsWith("RSI_")
      ? "RSI"
      : "Candle change";
}
export function alertValue(value: string, unit: string) {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toLocaleString("en-US", { maximumFractionDigits: 8 }) : value} ${unit}`;
}
export function alertSummary(report: MarketAlertReport) {
  const direction = report.condition.endsWith("_ABOVE") ? "above" : "below";
  return `${alertMetric(report)} moved ${direction} ${alertValue(report.threshold, report.unit)}`;
}
export function observationTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function MarketAlertDetails({ report }: { report: MarketAlertReport }) {
  const fields = [
    ["Recorded value", alertValue(report.value, report.unit)],
    ["Alert threshold", alertValue(report.threshold, report.unit)],
    ["Condition", `${alertMetric(report)} ${report.condition.endsWith("_ABOVE") ? "above" : "below"} threshold`],
    ["Timeframe", report.interval],
  ];
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed">{alertSummary(report)}.</p>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
        {fields.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="font-medium text-sm [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">Market observation</span>
        <time dateTime={report.observationAt} className="text-sm">
          {observationTime(report.observationAt)}
        </time>
        <span className="text-muted-foreground text-xs">
          {report.priceKind === "quote" ? "Provider quote" : "Completed candle close"}
        </span>
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm">Source & rule reference</summary>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Source</dt>
            <dd>{report.source}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Provider symbol</dt>
            <dd className="[overflow-wrap:anywhere]">{report.providerSymbol}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Alert rule</dt>
            <dd className="font-mono text-xs [overflow-wrap:anywhere]">{report.alertId}</dd>
          </div>
        </dl>
      </details>
    </div>
  );
}
