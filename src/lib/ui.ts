import type { groupColor } from "../types";

export const COLOR_HEX: Record<groupColor, string> = {
  grey: "#9a968a",
  blue: "#6b8cae",
  red: "#b87068",
  pink: "#c98aa0",
  purple: "#8e77b0",
  yellow: "#d4b246",
  green: "#6b8f71",
  cyan: "#5fa0a6",
  orange: "#d08f5a",
};

export interface PlanItem {
  name: string;
  tabIds: number[];
  confidence: number;
  on: boolean;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function timeAgo(ts: number, now: number = Date.now()): string {
  const m = Math.floor(Math.max(0, now - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${plural(h, "hour")} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}
