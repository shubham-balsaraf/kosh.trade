"use client";

import { useEffect, useRef } from "react";

export function useTrackView(feature: string) {
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "page_view", detail: feature }),
    }).catch(() => {});
  }, [feature]);
}
