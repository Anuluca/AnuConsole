import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import "dayjs/locale/zh-cn.js";

dayjs.extend(relativeTime);

export function formatRelativeTime(value: string | undefined, now: number): string {
  if (!value || !Number.isFinite(now) || !dayjs(value).isValid()) return "—";
  const seconds = Math.round((now - Date.parse(value)) / 1000);
  if (Math.abs(seconds) < 45) return `${Math.abs(seconds)} 秒${seconds < 0 ? "后" : "前"}`;
  return dayjs(value).locale("zh-cn").from(dayjs(now));
}
