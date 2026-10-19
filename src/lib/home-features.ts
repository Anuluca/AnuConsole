export type HomeFeatures = {
  lucarioHeadache: boolean;
  headacheCount: number | null;
  updatedAt: string | null;
};

export function isHomeFeatures(value: unknown): value is HomeFeatures {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.lucarioHeadache === "boolean" && (data.headacheCount === null || (Number.isSafeInteger(data.headacheCount) &&
    (data.headacheCount as number) >= 0)) && (data.updatedAt === null ||
    (typeof data.updatedAt === "string" && Number.isFinite(Date.parse(data.updatedAt))));
}

/** 兼容尚未发布计数功能的旧 Worker；null 表示次数未知，不能补成 0 或历史基数。 */
export function parseHomeFeatures(value: unknown): HomeFeatures | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const config = {
    lucarioHeadache: data.lucarioHeadache,
    headacheCount: "headacheCount" in data ? data.headacheCount : null,
    updatedAt: data.updatedAt,
  };
  return isHomeFeatures(config) ? config : null;
}
