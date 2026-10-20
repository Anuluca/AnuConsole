export type LikeCounts = { huahua: number; xiaohei: number };
export type LikeDay = { date: string; counts: LikeCounts; visitors: number; countries: Record<string, number>; devices: Record<string, number>; browsers: Record<string, number> };
export type FloraLikesAdmin = { counts: LikeCounts; version: string; updatedAt: string | null; limit: number; timezone: string; days: LikeDay[]; adjustments: { at: string; before: LikeCounts; after: LikeCounts }[] };
export function validCounts(value: unknown): value is LikeCounts {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'huahua,xiaohei') return false;
  const counts = value as LikeCounts;
  return [counts.huahua, counts.xiaohei].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1_000_000_000);
}
export function parseFloraLikes(value: unknown): FloraLikesAdmin | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as FloraLikesAdmin;
  const map = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.entries(v).every(([k,n]) => k.length < 50 && Number.isSafeInteger(n) && n >= 0);
  if (!validCounts(data.counts) || typeof data.version !== 'string' || !/^\d+$/.test(data.version) || data.timezone !== 'Asia/Shanghai' || data.limit !== 10 || !Array.isArray(data.days) || data.days.length > 90 || !data.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && validCounts(d.counts) && Number.isSafeInteger(d.visitors) && d.visitors >= 0 && map(d.countries) && map(d.devices) && map(d.browsers)) || !(data.updatedAt === null || (typeof data.updatedAt === 'string' && Number.isFinite(Date.parse(data.updatedAt)))) || !Array.isArray(data.adjustments) || data.adjustments.length > 30 || !data.adjustments.every(a => a && typeof a.at === 'string' && Number.isFinite(Date.parse(a.at)) && validCounts(a.before) && validCounts(a.after))) return null;
  return {counts:data.counts,version:data.version,updatedAt:data.updatedAt,limit:data.limit,timezone:data.timezone,days:data.days,adjustments:data.adjustments};
}
