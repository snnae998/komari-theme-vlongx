import { useEffect, useState } from "react";
import type { LatestStatus, LoadRecord, NodeInfo } from "../lib/api";
import { getRecords } from "../lib/api";
import {
  daysUntil,
  fmtBytes,
  fmtPercent,
  fmtSpeed,
  shortOs,
  trafficUsed,
} from "../lib/format";
import { fmtCycle, fmtDaysLeft, t } from "../lib/i18n";
import { osIcon } from "../lib/osIcon";
import type { ResolvedLatencySelection } from "../lib/latencySelection";
import Flag from "./Flag";
import LatencySelectionPanel from "./LatencySelectionPanel";

interface Props {
  node: NodeInfo;
  status?: LatestStatus;
  index: number;
  showLatency: boolean;
  latencySelections: ResolvedLatencySelection[];
  allLatencyTasks: ResolvedLatencySelection[];
  trafficResetDay: number;
  onClick: () => void;
}

const canTilt =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tiltMove(e: React.MouseEvent<HTMLElement>) {
  if (!canTilt) return;

  const r = e.currentTarget.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;

  e.currentTarget.style.transform = `perspective(900px) rotateX(${(
    -py * 3.5
  ).toFixed(2)}deg) rotateY(${(px * 4.5).toFixed(
    2,
  )}deg) translateY(-4px)`;
}

function tiltLeave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.transform = "";
}

const GRADS = {
  cpu: {
    grad: "linear-gradient(90deg,#818cf8,#a78bfa)",
    color: "#8b7cf6",
  },
  ram: {
    grad: "linear-gradient(90deg,#f472b6,#fb7185)",
    color: "#f4649e",
  },
  disk: {
    grad: "linear-gradient(90deg,#fbbf24,#fb923c)",
    color: "#f59e2b",
  },
  traffic: {
    grad: "linear-gradient(90deg,#38bdf8,#2dd4bf)",
    color: "#14b8c6",
  },
  trafficHot: {
    grad: "linear-gradient(90deg,#fb7185,#f43f5e)",
    color: "#f43f5e",
  },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  RMB: "¥",
  USD: "$",
  US$: "$",
  CAD: "C$",
  "C$": "C$",
  HKD: "HK$",
  "HK$": "HK$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  SGD: "S$",
  AUD: "A$",
};

function Bar({
  label,
  pct,
  grad,
  color,
  sub,
}: {
  label: string;
  pct: number;
  grad: string;
  color: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[12px] text-dim">{label}</span>

        <span
          className="text-[13px] font-semibold num"
          style={{ color }}
        >
          {pct.toFixed(pct >= 10 ? 0 : 1)}%

          {sub && (
            <span className="text-dim font-normal text-[11px]">
              {" "}
              · {sub}
            </span>
          )}
        </span>
      </div>

      <div className="bar-track">
        <div
          className="bar-fill"
          style={{
            width: `${pct}%`,
            background: grad,
          }}
        />
      </div>
    </div>
  );
}

function formatCount(value: number | undefined): string {
  return Math.max(0, Number(value) || 0).toLocaleString();
}

function ConnectionsRow({
  tcp,
  udp,
}: {
  tcp: number;
  udp: number;
}) {
  return (
    <div className="connection-row">
      <span className="text-[12px] text-dim">
        {t("connections")}
      </span>

      <div className="connection-values num">
        <span className="connection-item">
          <span className="connection-protocol">
            {t("tcp")}
          </span>

          <strong style={{ color: "#8b7cf6" }}>
            {formatCount(tcp)}
          </strong>
        </span>

        <span className="connection-divider">
          ·
        </span>

        <span className="connection-item">
          <span className="connection-protocol">
            {t("udp")}
          </span>

          <strong style={{ color: "#14b8c6" }}>
            {formatCount(udp)}
          </strong>
        </span>
      </div>
    </div>
  );
}

function normalizedResetDay(
  tags: string,
  fallback: number,
): number {
  const match = (tags || "").match(
    /(?:^|[;,])\s*traffic-reset\s*:\s*(\d{1,2})\s*(?:[;,]|$)/i,
  );

  const value = match
    ? Number(match[1])
    : Number(fallback);

  if (!Number.isFinite(value)) return 1;

  return Math.max(
    1,
    Math.min(28, Math.round(value)),
  );
}

function cycleStart(resetDay: number): Date {
  const now = new Date();

  let year = now.getFullYear();
  let month = now.getMonth();

  if (now.getDate() < resetDay) {
    month -= 1;

    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  return new Date(
    year,
    month,
    resetDay,
    0,
    0,
    0,
    0,
  );
}

function cumulativeDelta(
  records: LoadRecord[],
  key: "net_total_up" | "net_total_down",
  startMs: number,
): number {
  const sorted = [...records]
    .filter((r) =>
      Number.isFinite(Number(r[key])),
    )
    .sort(
      (a, b) =>
        new Date(a.time).getTime() -
        new Date(b.time).getTime(),
    );

  if (sorted.length === 0) return 0;

  let baselineIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (
      new Date(sorted[i].time).getTime() <=
      startMs
    ) {
      baselineIndex = i;
    } else {
      break;
    }
  }

  let previous = Math.max(
    0,
    Number(
      sorted[baselineIndex][key],
    ) || 0,
  );

  let total = 0;

  for (
    let i = baselineIndex + 1;
    i < sorted.length;
    i++
  ) {
    if (
      new Date(sorted[i].time).getTime() <
      startMs
    ) {
      continue;
    }

    const current = Math.max(
      0,
      Number(sorted[i][key]) || 0,
    );

    total +=
      current >= previous
        ? current - previous
        : current;

    previous = current;
  }

  return total;
}

function cycleTrafficFromRecords(
  records: LoadRecord[],
  resetDay: number,
  type: string,
): number | null {
  const start = cycleStart(resetDay);
  const startMs = start.getTime();

  const inCycle = records.filter(
    (r) =>
      new Date(r.time).getTime() >=
      startMs,
  );

  const hasDeltaTraffic =
    inCycle.some(
      (r) =>
        Number(r.traffic_up || 0) > 0 ||
        Number(r.traffic_down || 0) > 0,
    );

  if (hasDeltaTraffic) {
    const up = inCycle.reduce(
      (sum, r) =>
        sum +
        Math.max(
          0,
          Number(r.traffic_up || 0),
        ),
      0,
    );

    const down = inCycle.reduce(
      (sum, r) =>
        sum +
        Math.max(
          0,
          Number(r.traffic_down || 0),
        ),
      0,
    );

    return trafficUsed(
      up,
      down,
      type,
    );
  }

  const hasCounters =
    records.some(
      (r) =>
        Number.isFinite(
          Number(r.net_total_up),
        ) ||
        Number.isFinite(
          Number(r.net_total_down),
        ),
    );

  if (!hasCounters) return null;

  return trafficUsed(
    cumulativeDelta(
      records,
      "net_total_up",
      startMs,
    ),
    cumulativeDelta(
      records,
      "net_total_down",
      startMs,
    ),
    type,
  );
}

function useCycleTraffic(
  node: NodeInfo,
  index: number,
  defaultResetDay: number,
): number | null {
  const [value, setValue] =
    useState<number | null>(null);

  const resetDay =
    normalizedResetDay(
      node.tags,
      defaultResetDay,
    );

  useEffect(() => {
    if (!node.traffic_limit) {
      setValue(null);
      return;
    }

    let stopped = false;
    let timer: number | undefined;

    const load = async () => {
      try {
        const start =
          cycleStart(resetDay);

        const hours = Math.min(
          24 * 35,
          Math.max(
            1,
            Math.ceil(
              (Date.now() -
                start.getTime()) /
                3600000,
            ) + 3,
          ),
        );

        const response =
          await getRecords(
            node.uuid,
            hours,
          );

        if (!stopped) {
          setValue(
            cycleTrafficFromRecords(
              response.records || [],
              resetDay,
              node.traffic_limit_type,
            ),
          );
        }
      } catch {
        if (!stopped) {
          setValue(null);
        }
      }

      if (!stopped) {
        timer =
          window.setTimeout(
            load,
            5 * 60 * 1000,
          );
      }
    };

    timer =
      window.setTimeout(
        load,
        Math.min(
          250 + index * 80,
          2500,
        ),
      );

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [
    node.uuid,
    node.tags,
    node.traffic_limit,
    node.traffic_limit_type,
    index,
    resetDay,
  ]);

  return value;
}

function currencySymbol(
  currency: string,
): string {
  const value = String(
    currency || "$",
  ).trim();

  return (
    CURRENCY_SYMBOLS[
      value.toUpperCase()
    ] || value
  );
}

function billingText(
  node: NodeInfo,
): string | null {
  const price = Number(
    node.price,
  );

  if (
    !Number.isFinite(price) ||
    price === 0
  ) {
    return null;
  }

  const cycleDays =
    Number(node.billing_cycle);

  const cycle =
    Number.isFinite(cycleDays) &&
    cycleDays > 0
      ? fmtCycle(
          Math.round(cycleDays),
        )
      : "";

  const amount =
    price < 0
      ? t("free")
      : `${currencySymbol(
          node.currency,
        )}${price}`;

  return cycle
    ? `${amount}/${cycle}`
    : amount;
}

function onlineDays(
  uptime: number | undefined,
): number {
  const seconds = Math.max(
    0,
    Number(uptime) || 0,
  );

  return Math.floor(
    seconds / 86400,
  );
}

/* =====================================================
   TAG 自动颜色
   ===================================================== */

function tagColor(
  tag: string,
): string {
  const value =
    tag.trim().toLowerCase();

  /* 带宽 */

  if (
    value.includes("10gbps")
  )
    return "#f43f5e";

  if (
    value.includes("5gbps")
  )
    return "#ef4444";

  if (
    value.includes("2.5gbps")
  )
    return "#ec4899";

  if (
    value.includes("1gbps") ||
    value.includes("1000mbps")
  )
    return "#3b82f6";

  if (
    value.includes("500mbps")
  )
    return "#8b5cf6";

  if (
    value.includes("300mbps")
  )
    return "#a855f7";

  if (
    value.includes("200mbps")
  )
    return "#c026d3";

  if (
    value.includes("100mbps")
  )
    return "#7c3aed";

  if (
    value.includes("50mbps")
  )
    return "#14b8a6";

  if (
    value.includes("20mbps")
  )
    return "#10b981";

  if (
    value.includes("10mbps")
  )
    return "#22c55e";

  /* 中国 */

  if (
    value.includes("中国") ||
    value.includes("大陆") ||
    value.includes("北京") ||
    value.includes("上海") ||
    value.includes("深圳") ||
    value.includes("广州") ||
    value.includes("杭州") ||
    value.includes("成都") ||
    value.includes("重庆") ||
    value.includes("南京") ||
    value.includes("苏州") ||
    value.includes("厦门") ||
    value.includes("武汉") ||
    value.includes("西安") ||
    value.includes("青岛") ||
    value.includes("天津")
  )
    return "#f59e0b";

  /* 香港 */

  if (
    value.includes("香港") ||
    value.includes("九龙")
  )
    return "#ef4444";

  /* 澳门 */

  if (
    value.includes("澳门")
  )
    return "#16a34a";

  /* 台湾 */

  if (
    value.includes("台湾") ||
    value.includes("台北") ||
    value.includes("台中") ||
    value.includes("高雄")
  )
    return "#2563eb";

  /* 日本 */

  if (
    value.includes("日本") ||
    value.includes("东京") ||
    value.includes("大阪") ||
    value.includes("名古屋") ||
    value.includes("横滨") ||
    value.includes("京都") ||
    value.includes("福冈") ||
    value.includes("札幌")
  )
    return "#dc2626";

  /* 韩国 */

  if (
    value.includes("韩国") ||
    value.includes("首尔") ||
    value.includes("釜山") ||
    value.includes("仁川") ||
    value.includes("大田")
  )
    return "#2563eb";

  /* 新加坡 */

  if (
    value.includes("新加坡")
  )
    return "#f97316";

  /* 马来西亚 */

  if (
    value.includes("马来西亚") ||
    value.includes("吉隆坡") ||
    value.includes("槟城") ||
    value.includes("柔佛") ||
    value.includes("新山")
  )
    return "#16a34a";

  /* 泰国 */

  if (
    value.includes("泰国") ||
    value.includes("曼谷") ||
    value.includes("清迈")
  )
    return "#7c3aed";

  /* 越南 */

  if (
    value.includes("越南") ||
    value.includes("河内") ||
    value.includes("胡志明") ||
    value.includes("岘港")
  )
    return "#dc2626";

  /* 菲律宾 */

  if (
    value.includes("菲律宾") ||
    value.includes("马尼拉")
  )
    return "#0891b2";

  /* 印度尼西亚 */

  if (
    value.includes("印度尼西亚") ||
    value.includes("印尼") ||
    value.includes("雅加达") ||
    value.includes("泗水")
  )
    return "#ea580c";

  /* 美国 */

  if (
    value.includes("美国") ||
    value.includes("洛杉矶") ||
    value.includes("拉斯维加斯") ||
    value.includes("纽约") ||
    value.includes("圣何塞") ||
    value.includes("旧金山") ||
    value.includes("西雅图") ||
    value.includes("芝加哥") ||
    value.includes("达拉斯") ||
    value.includes("迈阿密") ||
    value.includes("波士顿") ||
    value.includes("华盛顿") ||
    value.includes("亚特兰大") ||
    value.includes("休斯顿") ||
    value.includes("丹佛") ||
    value.includes("凤凰城")
  )
    return "#2563eb";

  /* 加拿大 */

  if (
    value.includes("加拿大") ||
    value.includes("多伦多") ||
    value.includes("温哥华") ||
    value.includes("蒙特利尔") ||
    value.includes("卡尔加里")
  )
    return "#dc2626";

  /* 德国 */

  if (
    value.includes("德国") ||
    value.includes("法兰克福") ||
    value.includes("纽伦堡") ||
    value.includes("柏林") ||
    value.includes("慕尼黑") ||
    value.includes("汉堡") ||
    value.includes("杜塞尔多夫") ||
    value.includes("斯图加特") ||
    value.includes("科隆")
  )
    return "#8b5cf6";

  /* 法国 */

  if (
    value.includes("法国") ||
    value.includes("巴黎") ||
    value.includes("马赛") ||
    value.includes("里昂")
  )
    return "#2563eb";

  /* 英国 */

  if (
    value.includes("英国") ||
    value.includes("伦敦") ||
    value.includes("曼彻斯特") ||
    value.includes("伯明翰") ||
    value.includes("爱丁堡")
  )
    return "#dc2626";

  /* 荷兰 */

  if (
    value.includes("荷兰") ||
    value.includes("阿姆斯特丹") ||
    value.includes("鹿特丹")
  )
    return "#f97316";

  /* 芬兰 */

  if (
    value.includes("芬兰") ||
    value.includes("赫尔辛基")
  )
    return "#0284c7";

  /* 瑞典 */

  if (
    value.includes("瑞典") ||
    value.includes("斯德哥尔摩")
  )
    return "#eab308";

  /* 瑞士 */

  if (
    value.includes("瑞士") ||
    value.includes("苏黎世") ||
    value.includes("日内瓦")
  )
    return "#dc2626";

  /* 俄罗斯 */

  if (
    value.includes("俄罗斯") ||
    value.includes("莫斯科") ||
    value.includes("圣彼得堡")
  )
    return "#7c3aed";

  /* 澳大利亚 */

  if (
    value.includes("澳大利亚") ||
    value.includes("澳洲") ||
    value.includes("悉尼") ||
    value.includes("墨尔本") ||
    value.includes("布里斯班") ||
    value.includes("珀斯")
  )
    return "#0284c7";

  /* 新西兰 */

  if (
    value.includes("新西兰") ||
    value.includes("奥克兰") ||
    value.includes("惠灵顿")
  )
    return "#16a34a";

  /* 印度 */

  if (
    value.includes("印度") ||
    value.includes("孟买") ||
    value.includes("新德里") ||
    value.includes("班加罗尔") ||
    value.includes("海得拉巴")
  )
    return "#f97316";

  /* 土耳其 */

  if (
    value.includes("土耳其") ||
    value.includes("伊斯坦布尔") ||
    value.includes("安卡拉")
  )
    return "#dc2626";

  /* 巴西 */

  if (
    value.includes("巴西") ||
    value.includes("圣保罗") ||
    value.includes("里约热内卢")
  )
    return "#16a34a";

  /* 默认 */

  return "#94a3b8";
}

/* =====================================================
   TAG 解析
   ===================================================== */

function parseTags(
  value: string,
): {
  label: string;
  color: string;
}[] {
  return (value || "")
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        Boolean(s) &&
        !/^traffic-reset\s*:/i.test(
          s,
        ),
    )
    .slice(0, 3)
    .map((tag) => {
      /*
       * 支持：
       *
       * 1Gbps
       * 1Gbps#3b82f6
       * 1Gbps3b82f6
       *
       * 后两种都会自动去掉颜色代码。
       */

      const customColor =
        tag.match(
          /#([0-9a-fA-F]{6})$/,
        ) ||
        tag.match(
          /([0-9a-fA-F]{6})$/,
        );

      if (
        customColor &&
        customColor.index !==
          undefined
      ) {
        const index =
          customColor.index;

        const label =
          tag
            .slice(0, index)
            .trim();

        if (label) {
          return {
            label,
            color: `#${customColor[1]}`,
          };
        }
      }

      return {
        label: tag,
        color: tagColor(tag),
      };
    });
}

export default function NodeCard({
  node,
  status,
  index,
  showLatency,
  latencySelections,
  allLatencyTasks,
  trafficResetDay,
  onClick,
}: Props) {
  const online =
    !!status?.online;

  const cpu = status
    ? Math.min(
        100,
        status.cpu,
      )
    : 0;

  const ramPct = status
    ? fmtPercent(
        status.ram,
        status.ram_total ||
          node.mem_total,
      )
    : 0;

  const diskPct = status
    ? fmtPercent(
        status.disk,
        status.disk_total ||
          node.disk_total,
      )
    : 0;

  const trafficLimit =
    node.traffic_limit || 0;

  const cycleTraffic =
    useCycleTraffic(
      node,
      index,
      trafficResetDay,
    );

  const rawTraffic = status
    ? trafficUsed(
        status.net_total_up,
        status.net_total_down,
        node.traffic_limit_type,
      )
    : 0;

  const trafficUse =
    cycleTraffic ??
    rawTraffic;

  const trafficPct =
    trafficLimit > 0
      ? Math.min(
          100,
          (trafficUse /
            trafficLimit) *
            100,
        )
      : 0;

  const trafficStyle =
    trafficPct >= 90
      ? GRADS.trafficHot
      : GRADS.traffic;

  const expDays =
    daysUntil(
      node.expired_at,
    );

  const expSoon =
    expDays !== null &&
    expDays <= 15;

  const billing =
    billingText(node);

  const tags =
    parseTags(node.tags);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={node.name}
      onClick={onClick}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          onClick();
        }
      }}
      onMouseMove={tiltMove}
      onMouseLeave={tiltLeave}
      className={`node-card glass rounded-[20px] p-4 text-left w-full card-hover rise cursor-pointer ${
        online
          ? ""
          : "offline-card"
      }`}
      style={{
        animationDelay: `${Math.min(
          index * 55,
          600,
        )}ms`,
      }}
    >
      <div className="flex items-start gap-2.5 mb-3.5">
        <Flag
          region={node.region}
          size={24}
        />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[15px] truncate leading-tight">
            {node.name}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-dim truncate mt-0.5">
            <img
              src={osIcon(node.os)}
              alt=""
              width={13}
              height={13}
              loading="lazy"
              className="shrink-0 opacity-90"
            />

            <span className="truncate">
              {shortOs(node.os)} ·{" "}
              {node.arch}
            </span>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1 text-[11px] text-dim num">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                online
                  ? "dot-online"
                  : "dot-offline"
              }`}
            />

            <span>
              {online && status
                ? `${t(
                    "online",
                  )} ${onlineDays(
                    status.uptime,
                  )}${t("day")}`
                : t("offline")}
            </span>
          </div>

          {billing && (
            <span
              className="max-w-[112px] truncate whitespace-nowrap"
              title={billing}
            >
              {billing}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Bar
          label={t("cpu")}
          pct={
            online ? cpu : 0
          }
          grad={GRADS.cpu.grad}
          color={GRADS.cpu.color}
        />

        <Bar
          label={t("ram")}
          pct={
            online
              ? ramPct
              : 0
          }
          grad={GRADS.ram.grad}
          color={GRADS.ram.color}
          sub={
            online && status
              ? `${fmtBytes(
                  status.ram,
                )} / ${fmtBytes(
                  status.ram_total ||
                    node.mem_total,
                )}`
              : undefined
          }
        />

        <Bar
          label={t("disk")}
          pct={
            online
              ? diskPct
              : 0
          }
          grad={GRADS.disk.grad}
          color={GRADS.disk.color}
          sub={
            online && status
              ? `${fmtBytes(
                  status.disk,
                )} / ${fmtBytes(
                  status.disk_total ||
                    node.disk_total,
                )}`
              : undefined
          }
        />

        {trafficLimit > 0 && (
          <Bar
            label={t("traffic")}
            pct={
              online
                ? trafficPct
                : 0
            }
            grad={
              trafficStyle.grad
            }
            color={
              trafficStyle.color
            }
            sub={
              online && status
                ? `${fmtBytes(
                    trafficUse,
                  )} / ${fmtBytes(
                    trafficLimit,
                  )}`
                : undefined
            }
          />
        )}
      </div>

      {online && status && (
        <ConnectionsRow
          tcp={
            status.connections
          }
          udp={
            status.connections_udp
          }
        />
      )}

      {showLatency &&
        online && (
          <LatencySelectionPanel
            uuid={node.uuid}
            nodeName={node.name}
            cardIndex={index}
            ping={status?.ping}
            selections={
              latencySelections
            }
            hoverSelections={
              allLatencyTasks
            }
          />
        )}

      <div className="node-card-footer flex items-center gap-4 text-[12px] num">
        {online && status ? (
          <>
            <span className="whitespace-nowrap">
              <span
                style={{
                  color:
                    "#fb7185",
                }}
              >
                ↑
              </span>{" "}
              {fmtSpeed(
                status.net_out,
              )}
            </span>

            <span className="whitespace-nowrap">
              <span
                style={{
                  color:
                    "#2dd4bf",
                }}
              >
                ↓
              </span>{" "}
              {fmtSpeed(
                status.net_in,
              )}
            </span>
          </>
        ) : (
          <span className="min-w-0 truncate text-dim">
            {t("offline_hint")}
          </span>
        )}
      </div>

      {(tags.length > 0 ||
        expSoon) && (
        <div className="node-card-tags flex items-center gap-1.5 mt-2.5 flex-wrap">

          {expSoon && (
            <span
              className="text-[10.5px] px-2 py-0.5 rounded-full font-medium"
              style={{
                color:
                  expDays! <= 3
                    ? "#fb7185"
                    : "#f59e0b",

                background:
                  "var(--chip)",

                border: `1px solid ${
                  expDays! <= 3
                    ? "rgba(251,113,133,0.45)"
                    : "rgba(245,158,43,0.45)"
                }`,
              }}
            >
              {expDays! < 0
                ? t("expired")
                : fmtDaysLeft(
                    expDays!,
                  )}
            </span>
          )}

          {tags.map((tag) => (
            <span
              key={tag.label}
              className="text-[10.5px] px-2 py-0.5 rounded-full"
              style={{
                background:
                  "var(--chip)",

                border:
                  "1px solid var(--glass-border)",

                /*
                 * TAG 文字统一使用主题颜色。
                 * 暗色模式下就是白色/浅色。
                 */
                color:
                  "var(--text)",
              }}
            >
              {/* TAG 左侧彩色小圆点 */}
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                style={{
                  background:
                    tag.color,
                }}
              />

              {tag.label}
            </span>
          ))}

        </div>
      )}
    </article>
  );
}
