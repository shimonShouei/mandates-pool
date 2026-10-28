import type { Db } from "./db";
import { readGlobalRows } from "./board-cache";
import type { GlobalBoard } from "./public-state";

const DEFAULT_PAGE_SIZE = 40;

export async function globalLeaderboard(
  db: Db,
  options?: { page?: number; pageSize?: number },
): Promise<GlobalBoard> {
  const pageSize = clampPageSize(options?.pageSize);
  const stored = await readGlobalRows(db);
  const total = stored.rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.floor(options?.page || 1)), pageCount);
  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    total,
    pageCount,
    scoreable: stored.scoreable,
    thresholdBonus: stored.thresholdBonus,
    partyCount: stored.partyCount,
    rows: stored.rows.slice(start, start + pageSize),
  };
}

function clampPageSize(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(100, Math.max(1, Math.floor(value)));
}
