// 仅替换指定键，保留已有管理员配置、会话密钥、其他账号与业务密钥。
export function upsertEnvValues(source, updates) {
  const seen = new Set();
  const lines = source.split(/\r?\n/).map(line => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/);
    const key = match?.[1];
    if (!key || !Object.hasOwn(updates, key)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n").replace(/\n*$/, "")}\n`;
}
