export default function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <div className="font-mono text-lg font-semibold text-neutral-900">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{label}</div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-neutral-400">{hint}</div>
      )}
    </div>
  );
}