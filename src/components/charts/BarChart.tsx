export interface BarChartPoint {
  label: string;
  value: number;
  tooltip?: string;
}

export default function BarChart({
  data,
  formatValue = (v) => String(v),
  height = 72,
}: {
  data: BarChartPoint[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {data.map((d, i) => {
          const pct = d.value === 0 ? 0 : Math.max((d.value / max) * 100, 6);
          return (
            <div
              key={i}
              className="relative flex flex-1 items-end"
              style={{ height: "100%" }}
            >
              <div
                className={`w-full rounded-t-[2px] ${
                  d.value === 0 ? "bg-neutral-200" : "bg-neutral-800"
                }`}
                style={{
                  height: d.value === 0 ? "2px" : `${pct}%`,
                }}
                title={
                  d.tooltip ?? `${d.label}: ${formatValue(d.value)}`
                }
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}