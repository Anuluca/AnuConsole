export type HomeFeatures = {
  lucarioHeadache: boolean;
  headacheCount: number;
  updatedAt: string | null;
};

export function isHomeFeatures(value: unknown): value is HomeFeatures {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.lucarioHeadache === "boolean" && Number.isSafeInteger(data.headacheCount) &&
    (data.headacheCount as number) >= 0 && (data.updatedAt === null ||
    (typeof data.updatedAt === "string" && Number.isFinite(Date.parse(data.updatedAt))));
}
