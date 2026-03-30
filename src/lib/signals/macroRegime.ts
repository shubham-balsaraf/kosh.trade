import { getSeriesObservations, MACRO_SERIES } from "@/lib/api/fred";

export type MacroRegime = "EXPANSION" | "PEAK" | "CONTRACTION" | "TROUGH";

interface MacroSnapshot {
  regime: MacroRegime;
  gdpGrowth: number | null;
  unemployment: number | null;
  fedFunds: number | null;
  yieldCurve: number | null;
  cpiYoY: number | null;
  signals: string[];
}

function latestValue(data: any): number | null {
  const obs = data?.observations;
  if (!obs || obs.length === 0) return null;
  const val = parseFloat(obs[0]?.value);
  return isNaN(val) ? null : val;
}

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  const [gdpData, unempData, fedData, yieldData, cpiData] = await Promise.all([
    getSeriesObservations(MACRO_SERIES.GDP_GROWTH, 4).catch(() => null),
    getSeriesObservations(MACRO_SERIES.UNEMPLOYMENT, 6).catch(() => null),
    getSeriesObservations(MACRO_SERIES.FED_FUNDS, 3).catch(() => null),
    getSeriesObservations(MACRO_SERIES.YIELD_CURVE_10Y2Y, 3).catch(() => null),
    getSeriesObservations(MACRO_SERIES.CPI, 13).catch(() => null),
  ]);

  const gdpGrowth = latestValue(gdpData);
  const unemployment = latestValue(unempData);
  const fedFunds = latestValue(fedData);
  const yieldCurve = latestValue(yieldData);

  let cpiYoY: number | null = null;
  if (cpiData?.observations && cpiData.observations.length >= 13) {
    const latest = parseFloat(cpiData.observations[0]?.value);
    const yearAgo = parseFloat(cpiData.observations[12]?.value);
    if (!isNaN(latest) && !isNaN(yearAgo) && yearAgo > 0) {
      cpiYoY = ((latest - yearAgo) / yearAgo) * 100;
    }
  }

  const signals: string[] = [];
  let regime: MacroRegime = "EXPANSION";

  if (gdpGrowth !== null) {
    if (gdpGrowth > 2) signals.push("Strong GDP growth");
    else if (gdpGrowth > 0) signals.push("Moderate GDP growth");
    else signals.push("Negative GDP growth");
  }

  if (yieldCurve !== null) {
    if (yieldCurve < 0) signals.push("Inverted yield curve (recession signal)");
    else if (yieldCurve < 0.5) signals.push("Flattening yield curve");
    else signals.push("Normal yield curve");
  }

  if (unemployment !== null) {
    const unempObs = unempData?.observations || [];
    if (unempObs.length >= 3) {
      const trend = parseFloat(unempObs[0]?.value) - parseFloat(unempObs[2]?.value);
      if (trend > 0.3) signals.push("Rising unemployment");
      else if (trend < -0.3) signals.push("Falling unemployment");
      else signals.push("Stable unemployment");
    }
  }

  if (gdpGrowth !== null && gdpGrowth < 0) {
    regime = yieldCurve !== null && yieldCurve < 0 ? "CONTRACTION" : "TROUGH";
  } else if (gdpGrowth !== null && gdpGrowth > 3) {
    regime = "EXPANSION";
  } else if (yieldCurve !== null && yieldCurve < 0) {
    regime = "PEAK";
  }

  return { regime, gdpGrowth, unemployment, fedFunds, yieldCurve, cpiYoY, signals };
}
