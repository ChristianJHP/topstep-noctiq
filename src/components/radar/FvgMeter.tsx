import type { FvgBiasScore } from "@/lib/fvg-detect";

export function FvgMeter({ score }: { score: FvgBiasScore }) {
  const total =
    score.bullRespected +
    score.bullDisrespected +
    score.bearRespected +
    score.bearDisrespected;

  if (total === 0) {
    return (
      <div className="fvg-meter fvg-meter--empty" aria-label="FVG net unavailable">
        <span className="fvg-meter-label">FVG net</span>
        <div className="fvg-meter-track" />
        <span className="fvg-meter-net">—</span>
      </div>
    );
  }

  return (
    <div
      className="fvg-meter"
      role="img"
      aria-label={`FVG net ${score.net}, ${score.bullRespected} bull respected, ${score.bearRespected} bear respected`}
    >
      <span className="fvg-meter-label">FVG net</span>
      <div className="fvg-meter-track">
        {score.bullRespected > 0 ? (
          <span
            className="fvg-seg fvg-seg--br"
            style={{ flex: score.bullRespected }}
            title={`${score.bullRespected} bull respected`}
          />
        ) : null}
        {score.bullDisrespected > 0 ? (
          <span
            className="fvg-seg fvg-seg--bd"
            style={{ flex: score.bullDisrespected }}
            title={`${score.bullDisrespected} bull disrespected`}
          />
        ) : null}
        {score.bearDisrespected > 0 ? (
          <span
            className="fvg-seg fvg-seg--xbd"
            style={{ flex: score.bearDisrespected }}
            title={`${score.bearDisrespected} bear disrespected`}
          />
        ) : null}
        {score.bearRespected > 0 ? (
          <span
            className="fvg-seg fvg-seg--xr"
            style={{ flex: score.bearRespected }}
            title={`${score.bearRespected} bear respected`}
          />
        ) : null}
      </div>
      <span
        className={`fvg-meter-net${score.net > 0 ? " fvg-meter-net--pos" : score.net < 0 ? " fvg-meter-net--neg" : ""}`}
      >
        {score.net > 0 ? "+" : ""}
        {score.net}
      </span>
    </div>
  );
}
