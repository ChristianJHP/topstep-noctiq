const CHART_BAR_HEIGHTS = [
  38, 52, 44, 68, 41, 58, 36, 62, 48, 70, 42, 55, 64, 39, 50, 72, 46, 60,
];

export function Shimmer({ className = "" }: { className?: string }) {
  return <span className={`live-shimmer ${className}`.trim()} aria-hidden />;
}

export function LiveDots() {
  return (
    <span className="live-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

export function BiasSummarySkeleton() {
  return (
    <div className="bias-summary-skeleton" aria-hidden>
      <Shimmer className="live-shimmer--line live-shimmer--wide" />
      <Shimmer className="live-shimmer--line live-shimmer--mid" />
      <LiveDots />
    </div>
  );
}

export function NewsFeedSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section
      className="news-feed news-feed-skeleton"
      aria-label="Loading market news"
      aria-busy="true"
    >
      <header className="news-feed-head">
        <Shimmer className="live-shimmer--tag" />
        <Shimmer className="live-shimmer--tag live-shimmer--short" />
      </header>
      <ul className="news-feed-skeleton-list">
        {Array.from({ length: rows }).map((_, i) => (
          <li
            key={i}
            className="news-feed-skeleton-row"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <Shimmer className="live-shimmer--chip" />
            <Shimmer className="live-shimmer--line live-shimmer--wide" />
            <Shimmer className="live-shimmer--line live-shimmer--time" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ChartSkeleton() {
  return (
    <div className="mini-chart-skeleton mini-chart-canvas" aria-busy="true">
      <div className="mini-chart-skeleton-candles">
        {CHART_BAR_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="mini-chart-skeleton-candle"
            style={{
              height: `${h}%`,
              animationDelay: `${i * 0.04}s`,
            }}
          />
        ))}
      </div>
      <div className="mini-chart-skeleton-scan" aria-hidden />
      <div className="mini-chart-skeleton-axis" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="live-shimmer--axis" />
        ))}
      </div>
    </div>
  );
}

export function PriceSkeleton() {
  return (
    <div className="sym-col-price-wrap sym-col-price-wrap--skeleton" aria-hidden>
      <Shimmer className="live-shimmer--price" />
      <Shimmer className="live-shimmer--change" />
    </div>
  );
}
