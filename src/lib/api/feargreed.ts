const CNN_FG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata";

export interface FearGreedData {
  score: number;        // 0-100
  label: string;        // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  previousClose: number;
  oneWeekAgo: number;
  oneMonthAgo: number;
  oneYearAgo: number;
  timestamp: string;
}

function classifyScore(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

export async function getFearGreedIndex(): Promise<FearGreedData | null> {
  try {
    const res = await fetch(CNN_FG_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 1800 },
    });

    if (!res.ok) {
      const altRes = await fetch("https://api.alternative.me/fng/?limit=2", {
        next: { revalidate: 1800 },
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        const current = altData.data?.[0];
        const prev = altData.data?.[1];
        if (current) {
          const score = parseInt(current.value, 10);
          return {
            score,
            label: current.value_classification || classifyScore(score),
            previousClose: prev ? parseInt(prev.value, 10) : score,
            oneWeekAgo: score,
            oneMonthAgo: score,
            oneYearAgo: score,
            timestamp: new Date(parseInt(current.timestamp, 10) * 1000).toISOString(),
          };
        }
      }
      return null;
    }

    const data = await res.json();
    const fg = data.fear_and_greed;
    if (!fg) return null;

    const score = Math.round(fg.score || 0);
    return {
      score,
      label: fg.rating || classifyScore(score),
      previousClose: Math.round(fg.previous_close || score),
      oneWeekAgo: Math.round(fg.previous_1_week || score),
      oneMonthAgo: Math.round(fg.previous_1_month || score),
      oneYearAgo: Math.round(fg.previous_1_year || score),
      timestamp: fg.timestamp || new Date().toISOString(),
    };
  } catch (e) {
    console.warn("[FearGreed] getFearGreedIndex:", (e as Error).message);

    try {
      const altRes = await fetch("https://api.alternative.me/fng/?limit=1", {
        next: { revalidate: 1800 },
      });
      if (altRes.ok) {
        const altData = await altRes.json();
        const current = altData.data?.[0];
        if (current) {
          const score = parseInt(current.value, 10);
          return {
            score,
            label: current.value_classification || classifyScore(score),
            previousClose: score,
            oneWeekAgo: score,
            oneMonthAgo: score,
            oneYearAgo: score,
            timestamp: new Date(parseInt(current.timestamp, 10) * 1000).toISOString(),
          };
        }
      }
    } catch {
      // both sources failed
    }

    return null;
  }
}
