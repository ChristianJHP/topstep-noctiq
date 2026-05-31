const FJ_SCRIPT_URL = "https://feed.financialjuice.com/widgets/widgets.js";

let loadPromise: Promise<void> | null = null;

export type FJWidgetConfig = {
  container: string;
  widgetType: "ECOCAL" | "NEWS";
  mode: string;
  width?: string;
  height: string;
  backColor: string;
  fontColor: string;
};

declare global {
  interface Window {
    FJWidgets?: {
      createWidget: (options: FJWidgetConfig) => void;
    };
  }
}

function hasFjApi(): boolean {
  return typeof window.FJWidgets?.createWidget === "function";
}

/** Load widgets.js once. Do NOT pre-assign window.FJWidgets — that blocks the script. */
export function loadFinancialJuiceScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (hasFjApi()) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-fj-widgets="1"]'
    );

    const done = () => {
      if (hasFjApi()) resolve();
      else reject(new Error("FinancialJuice API missing after load"));
    };

    if (existing) {
      if (existing.getAttribute("data-loaded") === "1") {
        done();
        return;
      }
      existing.addEventListener("load", done);
      existing.addEventListener("error", () =>
        reject(new Error("FinancialJuice widgets failed to load"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = FJ_SCRIPT_URL;
    script.async = true;
    script.dataset.fjWidgets = "1";
    script.onload = () => {
      script.setAttribute("data-loaded", "1");
      done();
    };
    script.onerror = () =>
      reject(new Error("FinancialJuice widgets failed to load"));
    document.body.appendChild(script);
  });

  return loadPromise;
}

function resolveWidth(
  el: HTMLElement,
  width: string | undefined
): string {
  if (!width || width === "100%") {
    const px = el.clientWidth || el.parentElement?.clientWidth || 500;
    return `${Math.max(px, 320)}px`;
  }
  return width;
}

/** Mount iframe widget via FJWidgets.createWidget (see financialjuice.com/widgets). */
export async function mountFinancialJuiceWidget(
  config: FJWidgetConfig
): Promise<void> {
  const el = document.getElementById(config.container);
  if (!el) return;

  await loadFinancialJuiceScript();

  window.FJWidgets!.createWidget({
    ...config,
    width: resolveWidth(el, config.width),
  });
}
