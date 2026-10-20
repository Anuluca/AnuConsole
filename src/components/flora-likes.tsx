"use client";

import { useEffect, useRef, useState } from "react";
import { parseFloraLikes, validCounts, type FloraLikesAdmin } from "@/lib/flora-likes";
import { ManagementButton } from "./infrastructure/management-button";
import { LoadingIndicator } from "./loading-indicator";

const names = { huahua: "花花", xiaohei: "小黑" };
const devices: Record<string, string> = { desktop: "桌面", mobile: "手机", tablet: "平板", unknown: "未知" };
const dimensions = [["countries", "国家／地区"], ["devices", "设备"]] as const;

function HeartIcon() {
  return <svg className="feature-heading-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z" /></svg>;
}

export function FloraLikesPanel({ canEdit, refreshToken = 0 }: { canEdit: boolean; refreshToken?: number }) {
  const [data, setData] = useState<FloraLikesAdmin | null>(null);
  const [draft, setDraft] = useState({ huahua: "", xiaohei: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [range, setRange] = useState(0);
  const current = useRef<AbortController | null>(null);

  async function request(save = false) {
    if (save && !canEdit) return;
    const counts = { huahua: Number(draft.huahua), xiaohei: Number(draft.xiaohei) };
    if (save && (!data || !draft.huahua.trim() || !draft.xiaohei.trim() || !validCounts(counts))) {
      setError("请输入 0–1,000,000,000 之间的整数。");
      return;
    }

    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/data/flora-likes", {
        method: save ? "PUT" : "GET",
        headers: save ? { "Content-Type": "application/json" } : undefined,
        body: save ? JSON.stringify({ counts, version: data!.version }) : undefined,
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 409) throw new Error("期间出现了新点击或其他修改，请重新读取后再保存。");
      const value = parseFloraLikes(await response.json());
      if (!response.ok || !value) throw new Error(save ? "保存结果未确认，请重新读取。" : "无法读取喜爱数据，请确认 Worker 已部署并配置管理密钥。");
      setData(value);
      setDraft({ huahua: String(value.counts.huahua), xiaohei: String(value.counts.xiaohei) });
      if (save) setNotice("已保存。网站重新读取数据后生效，实际点击统计保持不变。");
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "请求失败。");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  useEffect(() => {
    void request();
    return () => current.current?.abort();
  }, [refreshToken]);

  const cutoff = range === 0 ? "" : new Date(Date.now() + 8 * 3600000 - (range - 1) * 86400000).toISOString().slice(0, 10);
  const days = data?.days.filter((day) => !cutoff || day.date >= cutoff) ?? [];
  const aggregate = (field: (typeof dimensions)[number][0]) => {
    const values: Record<string, number> = {};
    for (const day of days) for (const [label, value] of Object.entries(day[field])) values[label] = (values[label] ?? 0) + value;
    return Object.entries(values).sort(([, first], [, second]) => second - first);
  };

  return (
    <section className="flora-likes-panel" aria-label="花花小窝数据模块">
      <section className="feature-module" aria-labelledby="flora-likes-title">
        <header><h2 id="flora-likes-title"><HeartIcon />喜爱数量</h2></header>
        <div className="flora-likes-body">
          <p>每日共享 10 次额度，北京时间零点重置，跨设备、清除存储可能获得新额度，统计保留近 90 天，不采集 IP。</p>
          {pending && !data ? <LoadingIndicator label="正在读取喜爱数据" /> : (
            <form className="flora-likes-form" onSubmit={(event) => { event.preventDefault(); void request(true); }}>
              <div className="flora-like-editors">
                {(Object.keys(names) as (keyof typeof names)[]).map((pet) => (
                  <label key={pet}>
                    <span>{names[pet]}</span>
                    <input type="number" min="0" max="1000000000" step="1" required value={draft[pet]} disabled={!canEdit || pending || !data}
                      onChange={(event) => setDraft((value) => ({ ...value, [pet]: event.target.value }))} />
                  </label>
                ))}
              </div>
              <div className="flora-like-actions">
                {canEdit && <ManagementButton icon="check" type="submit" disabled={pending || !data}>{pending ? "处理中…" : "保存数量"}</ManagementButton>}
              </div>
            </form>
          )}
          {error && <p role="alert" className="flora-like-error">{error}</p>}
          {notice && <p role="status">{notice}</p>}
        </div>
      </section>

      <section className="feature-module" aria-labelledby="flora-statistics-title">
        <header className="flora-statistics-header">
          <h2 id="flora-statistics-title"><HeartIcon />点击统计</h2>
          <div className="flora-like-actions">
            {[0, 7, 30].map((daysCount) => <ManagementButton icon="details" key={daysCount} type="button" aria-pressed={range === daysCount} onClick={() => setRange(daysCount)}>{daysCount === 0 ? "全部" : `近 ${daysCount} 天`}</ManagementButton>)}
          </div>
        </header>
        <div className="flora-likes-body">
          {data ? <>
            <div className="flora-like-metrics">
              <span>有效点击 <b>{days.reduce((total, day) => total + day.counts.huahua + day.counts.xiaohei, 0)}</b></span>
              <span>花花 <b>{days.reduce((total, day) => total + day.counts.huahua, 0)}</b></span>
              <span>小黑 <b>{days.reduce((total, day) => total + day.counts.xiaohei, 0)}</b></span>
              <span>访客日数 <b>{days.reduce((total, day) => total + day.visitors, 0)}</b></span>
            </div>
            <div className="flora-statistics-details">
            <div className="flora-like-table"><table><thead><tr><th>日期（北京时间）</th><th>花花</th><th>小黑</th><th>独立访客</th></tr></thead><tbody>{days.map((day) => <tr key={day.date}><td>{day.date}</td><td>{day.counts.huahua}</td><td>{day.counts.xiaohei}</td><td>{day.visitors}</td></tr>)}</tbody></table></div>
            <div className="flora-like-dimensions">
              {dimensions.map(([field, label]) => <section key={field}>
                <h4>{label}</h4>
                <ul>{aggregate(field).map(([dimension, value]) => <li key={dimension}><span>{field === "devices" ? devices[dimension] ?? dimension : dimension === "unknown" ? "未知" : dimension}</span><span>{value}</span></li>)}</ul>
                {!days.length && <p>暂无点击记录</p>}
              </section>)}
            </div>
            </div>
          </> : <p>读取成功后显示统计。</p>}
        </div>
      </section>

      {data && data.adjustments.length > 0 && <section className="feature-module" aria-labelledby="flora-audit-title">
        <header><h2 id="flora-audit-title">最近数量调整</h2></header>
        <div className="flora-likes-body"><ul className="flora-like-audit">{data.adjustments.map((adjustment, index) => <li key={`${adjustment.at}-${index}`}><time>{new Date(adjustment.at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</time><span>花花 {adjustment.before.huahua} → {adjustment.after.huahua}；小黑 {adjustment.before.xiaohei} → {adjustment.after.xiaohei}</span></li>)}</ul></div>
      </section>}
    </section>
  );
}
