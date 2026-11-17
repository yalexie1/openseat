export type SeatStatus = "full" | "open" | "unknown";

export type CatalogCourse = {
  id: number;
  crn: number | null;
  codes: string[];
  code: string;
  title: string;
  section: string;
  profs: string[];
  credits: number | null;
};

export type WatchedCourse = {
  id: number;
  crn: number | null;
  code: string;
  title: string;
  section: string;
  profs: string[];
  status: SeatStatus;
  addedAt: number;
  openedAt?: number;
  notifiedAt?: number;
};

export const SEASON = "202701";
export const SEASON_LABEL = "Spring 2027";
export const STORAGE_KEY = "openseat-watchlist-v1";
export const CATALOG_PATH = `/catalog-${SEASON}.json`;

export function yaleSearchUrl(code: string): string {
  const q = encodeURIComponent(code);
  return `https://courses.yale.edu/?keyword=${q}&srcdb=${SEASON}`;
}