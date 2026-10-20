import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

// 监听 0.0.0.0 时，开发来源仍需明确允许实际访问地址。
// 使用本机网卡地址，兼容 DHCP 变化，同时避免开放任意来源。
const developmentHosts = [...new Set([
  "127.0.0.1",
  ...Object.values(networkInterfaces()).flatMap(addresses =>
    (addresses ?? []).filter(address => address.family === "IPv4" && !address.internal)
      .map(address => address.address)
  ),
])];

const config: NextConfig = {
  allowedDevOrigins: developmentHosts,
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "same-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" }
      ]
    }];
  }
};

export default config;
