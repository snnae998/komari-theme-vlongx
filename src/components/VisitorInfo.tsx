import { useEffect, useState } from "react";
import { t } from "../lib/i18n";

interface Props {
  enabled: boolean;
  endpoint?: string;
}

interface VisitorState {
  ip: string;
  loading: boolean;
  failed: boolean;
}

/**
 * IP 查询接口按顺序尝试。
 * 如果第一个失败，会自动尝试下一个。
 */
const DEFAULT_ENDPOINTS = [
  "https://api.ipify.org?format=json",
  "https://api64.ipify.org?format=json",
  "https://api.ip.sb/ip",
  "https://ipwho.is/",
];

function extractIp(payload: unknown): string {
  // 接口直接返回纯文本 IP
  if (typeof payload === "string") {
    const value = payload.trim();

    // 去掉可能的 JSON 字符串引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1).trim();
    }

    return value;
  }

  // 接口返回 JSON
  if (!payload || typeof payload !== "object") return "";

  const value = payload as Record<string, unknown>;

  for (const key of [
    "ip",
    "query",
    "address",
    "client_ip",
    "ip_address",
  ]) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

async function fetchIp(
  url: string,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`visitor ip: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";

  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  const ip = extractIp(payload);

  if (!ip) {
    throw new Error("visitor ip missing");
  }

  return ip;
}

export default function VisitorInfo({ enabled, endpoint }: Props) {
  const [state, setState] = useState<VisitorState>({
    ip: "",
    loading: false,
    failed: false,
  });

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

    const endpoints = endpoint?.trim()
      ? [endpoint.trim(), ...DEFAULT_ENDPOINTS]
      : DEFAULT_ENDPOINTS;

    setState({
      ip: "",
      loading: true,
      failed: false,
    });

    const run = async () => {
      for (const url of endpoints) {
        if (disposed) return;

        const controller = new AbortController();

        // 每个接口最多等待 4 秒
        const timeout = window.setTimeout(() => {
          controller.abort();
        }, 4000);

        try {
          const ip = await fetchIp(url, controller.signal);

          window.clearTimeout(timeout);

          if (!disposed) {
            setState({
              ip,
              loading: false,
              failed: false,
            });
          }

          return;
        } catch {
          window.clearTimeout(timeout);
        }
      }

      if (!disposed) {
        setState({
          ip: "",
          loading: false,
          failed: true,
        });
      }
    };

    run();

    return () => {
      disposed = true;
    };
  }, [enabled, endpoint]);

  if (!enabled) return null;

  const ipType = state.ip.includes(":")
    ? "IPv6"
    : state.ip
      ? "IPv4"
      : "";

  return (
    <div className="visitor-ip glass" aria-live="polite">
      <span className="visitor-ip-icon" aria-hidden>
        ◎
      </span>

      <span className="visitor-ip-label">
        {t("visitorIp")}
      </span>

      <strong className="visitor-ip-value num">
        {state.loading
          ? t("loadingShort")
          : state.failed
            ? t("unavailable")
            : state.ip}
      </strong>

      {ipType && (
        <span className="visitor-ip-type">
          {ipType}
        </span>
      )}
    </div>
  );
}
