import type { IntervalBias } from "@/lib/htf-status";

function TfDot({ label, bias }: { label: string; bias: IntervalBias }) {
  return (
    <span
      className={`tf-dot tf-dot--${bias.bias}`}
      title={`${label} ${bias.label}`}
      aria-label={`${label} ${bias.label}`}
    >
      <span className="tf-dot-label">{label}</span>
    </span>
  );
}

export function CandleStateDots({
  fourHour,
  oneHour,
}: {
  fourHour: IntervalBias;
  oneHour: IntervalBias;
}) {
  return (
    <div className="tf-dots">
      <TfDot label="4H" bias={fourHour} />
      <TfDot label="1H" bias={oneHour} />
    </div>
  );
}
