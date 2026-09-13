export interface NodeInfo {
  uuid: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  gpu_name: string;
  region: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  weight: number;
  price: number;
  billing_cycle: number;
  currency: string;
  expired_at: string | null;
  group: string;
  tags: string;
  hidden: boolean;
  traffic_limit: number;
  traffic_limit_type: string;
}

export interface LatestStatus {
  client: string;
  time: string;
  cpu: number;
  gpu: number;
  ram: number;
  ram_total: number;
  swap: number;
  swap_total: number;
  load: number;
  load5: number;
  load15: number;
  disk: number;
  disk_total: number;
  net_in: number;
  net_out: number;
  net_total_up: number;
  net_total_down: number;
  process: number;
  connections: number;
  connections_udp: number;
  online: boolean;
  uptime: number;
  ping: Record<string, PingStat>;
}

export interface PingStat {
  name: string;
  latest: number;
  avg: number;
  tail: number;
  loss: number;
  min: number;
  max: number;
}

export interface PublicInfo {
  sitename: string;
  description: string;
  theme_settings: Record<string, unknown>;
}

export interface LoadRecord {
  time: string;
  cpu: number;
  gpu?: number;
  ram: number;
  ram_total: number;
  swap: number;
  swap_total: number;
  load: number;
  disk: number;
  disk_total: number;
  net_in: number;
  net_out: number;
  net_total_up?: number;
  net_total_down?: number;
  traffic_up?: number;
  traffic_down?: number;
  connections: number;
  connections_udp: number;
  process: number;
}

export interface GPURecord {
  client: string;
  time: string;
  device_index: number;
  device_name: string;
  mem_total: number;
  mem_used: number;
  utilization: number;
  temperature: number;
}

export interface GPUDeviceHistory {
  device_index: number;
  device_name: string;
  records: GPURecord[];
}

export interface LoadRecordsResponse {
  count: number;
  records: LoadRecord[];
  has_gpu_data?: boolean;
  gpu_devices?: Record<string, GPUDeviceHistory>;
}

export interface PingTask {
  id: number;
  name: string;
  interval: number;
  type?: "icmp" | "tcp" | "http" | string;
  target?: string;
  clients?: string[];
  default_on?: boolean;
  weight?: number;
  loss?: number;
}

export interface PingRecord {
  task_id: number;
  time: string;
  value: number;
}

/* =========================================================
 * CF-Server-Monitor API
 * ========================================================= */

interface CFSMServer {
  id: string;
  name: string;
  sort_order?: number;
  server_group?: string;
  tags?: string;

  price?: string | number;
  billing_cycle?: string;
  currency?: string;
  expire_date?: string;

  traffic_limit?: string;
  traffic_calc_type?: string;

  is_hidden?: string;

  cpu?: number;
  load_avg?: string;

  net_in_speed?: number;
  net_out_speed?: number;
  net_rx?: number;
  net_tx?: number;
  net_rx_monthly?: number;
  net_tx_monthly?: number;

  processes?: number;
  tcp_conn?: number;
  udp_conn?: number;

  ping_ct?: number | null | false;
  ping_cu?: number | null | false;
  ping_cm?: number | null | false;
  ping_bd?: number | null | false;

  loss_ct?: number | null | false;
  loss_cu?: number | null | false;
  loss_cm?: number | null | false;
  loss_bd?: number | null | false;

  ping?: Array<{
    ts: number;
    ct?: number | null | false;
    cu?: number | null | false;
    cm?: number | null | false;
    bd?: number | null | false;
  }>;

  ram_total?: number;
  ram_used?: number;

  swap_total?: number;
  swap_used?: number;

  disk_total?: number;
  disk_used?: number;

  disk?: {
    read_bps?: number;
    write_bps?: number;
    read_iops?: number;
    write_iops?: number;
    await_ms?: number;
    util?: number;
  };

  cpu_cores?: number;
  cpu_info?: string;

  gpu_info?: string | Array<{
    id?: string;
    name?: string;
    info?: number;
  }> | null;

  arch?: string;
  os?: string;
  kernel_version?: string;

  region?: string;
  ip_v4?: string;
  ip_v6?: string;

  boot_time?: string | number;
  last_updated?: number;

  is_online?: boolean;
}

interface ServersResponse {
  servers: CFSMServer[];
  latestReportUpdates?: unknown[];
  stats?: unknown;
  regionStats?: unknown;
  sysConfig?: unknown;
}

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);

  if (!r.ok) {
    throw new Error(`${url}: ${r.status}`);
  }

  return (await r.json()) as T;
}

/* =========================================================
 * 工具函数
 * ========================================================= */

function number(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mbToBytes(value: unknown): number {
  return number(value) * 1024 * 1024;
}

function parseLoad(value: unknown): [number, number, number] {
  if (typeof value !== "string") {
    return [0, 0, 0];
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter(Number.isFinite);

  return [
    parts[0] ?? 0,
    parts[1] ?? 0,
    parts[2] ?? 0,
  ];
}

function parsePrice(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return n;
}

function billingCycleToDays(value: unknown): number {
  switch (String(value ?? "").toLowerCase()) {
    case "month":
      return 30;

    case "quarter":
      return 90;

    case "half_year":
      return 180;

    case "year":
      return 365;

    case "two_years":
      return 730;

    case "three_years":
      return 1095;

    case "four_years":
      return 1460;

    case "five_years":
      return 1825;

    default:
      return 30;
  }
}

function parseTrafficLimit(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const text = String(value).trim();

  if (!text) {
    return 0;
  }

  const match = text.match(
    /^([\d.]+)\s*(KB|MB|GB|TB|PB)?$/i,
  );

  if (!match) {
    return number(text, 0);
  }

  const valueNumber = Number(match[1]);
  const unit = (match[2] || "B").toUpperCase();

  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
    PB: 1024 ** 5,
  };

  return valueNumber * (units[unit] || 1);
}

function gpuName(server: CFSMServer): string {
  const gpu = server.gpu_info;

  if (!gpu) {
    return "";
  }

  if (typeof gpu === "string") {
    try {
      return gpuName({
        ...server,
        gpu_info: JSON.parse(gpu),
      });
    } catch {
      return "";
    }
  }

  if (!Array.isArray(gpu)) {
    return "";
  }

  return gpu
    .map((item) => item?.name || "")
    .filter(Boolean)
    .join(", ");
}

function gpuUsage(server: CFSMServer): number {
  const gpu = server.gpu_info;

  if (!gpu) {
    return 0;
  }

  if (typeof gpu === "string") {
    try {
      return gpuUsage({
        ...server,
        gpu_info: JSON.parse(gpu),
      });
    } catch {
      return 0;
    }
  }

  if (!Array.isArray(gpu) || gpu.length === 0) {
    return 0;
  }

  const values = gpu
    .map((item) => number(item?.info))
    .filter(Number.isFinite);

  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

function online(server: CFSMServer): boolean {
  if (typeof server.is_online === "boolean") {
    return server.is_online;
  }

  if (!server.last_updated) {
    return false;
  }

  return Date.now() - Number(server.last_updated) <= 5 * 60 * 1000;
}

function uptimeSeconds(server: CFSMServer): number {
  if (server.boot_time === undefined || server.boot_time === null) {
    return 0;
  }

  const boot = number(server.boot_time);

  if (!boot) {
    return 0;
  }

  const bootMs = boot < 10_000_000_000
    ? boot * 1000
    : boot;

  return Math.max(
    0,
    Math.floor((Date.now() - bootMs) / 1000),
  );
}

/* =========================================================
 * CF-Server-Monitor → Komari 数据结构适配
 * ========================================================= */

function toNodeInfo(server: CFSMServer): NodeInfo {
  return {
    uuid: server.id,
    name: server.name,

    cpu_name: server.cpu_info || "",
    virtualization: "",

    arch: server.arch || "",
    cpu_cores: number(server.cpu_cores),

    os: server.os || "",
    gpu_name: gpuName(server),

    region: server.region || "",

    // CF-Server-Monitor 的容量单位是 MB
    mem_total: mbToBytes(server.ram_total),
    swap_total: mbToBytes(server.swap_total),
    disk_total: mbToBytes(server.disk_total),

    weight: number(server.sort_order),

    price: parsePrice(server.price),

    billing_cycle: billingCycleToDays(
      server.billing_cycle,
    ),

    currency: server.currency || "",

    expired_at:
      server.expire_date
        ? `${server.expire_date} 00:00:00`
        : null,

    group: server.server_group || "Default",

    tags: server.tags || "",

    hidden: server.is_hidden === "1",

    traffic_limit:
      parseTrafficLimit(server.traffic_limit),

    traffic_limit_type:
      server.traffic_calc_type || "total",
  };
}

function toLatestStatus(
  server: CFSMServer,
): LatestStatus {
  const load = parseLoad(server.load_avg);

  const ramTotal = mbToBytes(server.ram_total);
  const ramUsed = mbToBytes(server.ram_used);

  const swapTotal = mbToBytes(server.swap_total);
  const swapUsed = mbToBytes(server.swap_used);

  const diskTotal = mbToBytes(server.disk_total);
  const diskUsed = mbToBytes(server.disk_used);

  const ramPercent =
    ramTotal > 0
      ? (ramUsed / ramTotal) * 100
      : 0;

  const swapPercent =
    swapTotal > 0
      ? (swapUsed / swapTotal) * 100
      : 0;

  const diskPercent =
    diskTotal > 0
      ? (diskUsed / diskTotal) * 100
      : 0;

  const ping: Record<string, PingStat> = {};

  const pingItems = [
    {
      key: "ct",
      name: "电信",
      value: server.ping_ct,
      loss: server.loss_ct,
    },
    {
      key: "cu",
      name: "联通",
      value: server.ping_cu,
      loss: server.loss_cu,
    },
    {
      key: "cm",
      name: "移动",
      value: server.ping_cm,
      loss: server.loss_cm,
    },
    {
      key: "bd",
      name: "BGP",
      value: server.ping_bd,
      loss: server.loss_bd,
    },
  ];

  for (const item of pingItems) {
    if (
      item.value !== null &&
      item.value !== undefined &&
      item.value !== false
    ) {
      const value = number(item.value);

      ping[item.key] = {
        name: item.name,
        latest: value,
        avg: value,
        tail: value,
        loss: number(item.loss),
        min: value,
        max: value,
      };
    }
  }

  return {
    client: server.id,

    time: server.last_updated
      ? new Date(server.last_updated).toISOString()
      : new Date().toISOString(),

    cpu: number(server.cpu),

    gpu: gpuUsage(server),

    ram: ramPercent,
    ram_total: ramTotal,

    swap: swapPercent,
    swap_total: swapTotal,

    load: load[0],
    load5: load[1],
    load15: load[2],

    disk: diskPercent,
    disk_total: diskTotal,

    net_in: number(server.net_in_speed),
    net_out: number(server.net_out_speed),

    net_total_up: number(server.net_tx),
    net_total_down: number(server.net_rx),

    process: number(server.processes),

    connections: number(server.tcp_conn),
    connections_udp: number(server.udp_conn),

    online: online(server),

    uptime: uptimeSeconds(server),

    ping,
  };
}

/* =========================================================
 * 站点配置
 * ========================================================= */

export const getPublicInfo = async (): Promise<PublicInfo> => {
  const config = await getJSON<any>("/api/config");

  return {
    sitename:
      config.site_title ||
      "CF-Server-Monitor",

    description:
      config.description ||
      "",

    theme_settings:
      config.theme_options ||
      {},
  };
};

/* =========================================================
 * 服务器列表
 * ========================================================= */

export const getNodes = async (): Promise<NodeInfo[]> => {
  const response =
    await getJSON<ServersResponse>(
      "/api/servers",
    );

  return (response.servers || [])
    .filter((server) => !server.is_hidden || server.is_hidden !== "1")
    .map(toNodeInfo);
};

/* =========================================================
 * 最新状态
 *
 * CF-Server-Monitor 的 /api/servers 已经带有
 * 最新指标，所以这里直接转换。
 * ========================================================= */

export const getLatest =
  async (): Promise<Record<string, LatestStatus>> => {
    const response =
      await getJSON<ServersResponse>(
        "/api/servers",
      );

    const result: Record<string, LatestStatus> = {};

    for (const server of response.servers || []) {
      if (server.is_hidden === "1") {
        continue;
      }

      result[server.id] =
        toLatestStatus(server);
    }

    return result;
  };

/* =========================================================
 * 历史负载
 *
 * CFSM:
 * GET /api/history/all?id=xxx&hours=24
 * ========================================================= */

export const getRecords = async (
  uuid: string,
  hours: number,
): Promise<LoadRecordsResponse> => {
  const allowedHours = [
    0.167,
    0.5,
    1,
    6,
    12,
    24,
    48,
    96,
    168,
  ];

  let selectedHours = hours;

  if (!allowedHours.includes(selectedHours)) {
    selectedHours =
      allowedHours.reduce(
        (prev, current) =>
          Math.abs(current - hours) <
          Math.abs(prev - hours)
            ? current
            : prev,
        allowedHours[0],
      );
  }

  const rows =
    await getJSON<any[]>(
      `/api/history/all?id=${encodeURIComponent(
        uuid,
      )}&hours=${selectedHours}`,
    );

  const records: LoadRecord[] =
    (rows || []).map((row) => {
      const ramTotal =
        mbToBytes(row.ram_total);

      const ramUsed =
        mbToBytes(row.ram_used);

      const swapTotal =
        mbToBytes(row.swap_total);

      const swapUsed =
        mbToBytes(row.swap_used);

      const diskTotal =
        mbToBytes(row.disk_total);

      const diskUsed =
        mbToBytes(row.disk_used);

      const load =
        parseLoad(row.load_avg);

      return {
        time:
          new Date(
            number(row.timestamp),
          ).toISOString(),

        cpu: number(row.cpu),

        gpu: gpuUsage({
          gpu_info: row.gpu_info,
        } as CFSMServer),

        ram:
          ramTotal > 0
            ? (ramUsed / ramTotal) * 100
            : 0,

        ram_total: ramTotal,

        swap:
          swapTotal > 0
            ? (swapUsed / swapTotal) * 100
            : 0,

        swap_total: swapTotal,

        load: load[0],

        disk:
          diskTotal > 0
            ? (diskUsed / diskTotal) * 100
            : 0,

        disk_total: diskTotal,

        net_in:
          number(row.net_in_speed),

        net_out:
          number(row.net_out_speed),

        net_total_up:
          number(row.net_tx),

        net_total_down:
          number(row.net_rx),

        traffic_up:
          number(row.net_tx),

        traffic_down:
          number(row.net_rx),

        connections:
          number(row.tcp_conn),

        connections_udp:
          number(row.udp_conn),

        process:
          number(row.processes),
      };
    });

  return {
    count: records.length,
    records,
  };
};

/* =========================================================
 * Ping 任务
 *
 * CFSM 没有 Komari 那种动态 Ping Task，
 * 目前固定映射四个运营商线路。
 * ========================================================= */

export const getPingTasks =
  async (): Promise<PingTask[]> => {
    return [
      {
        id: 1,
        name: "电信",
        interval: 120,
        type: "icmp",
      },
      {
        id: 2,
        name: "联通",
        interval: 120,
        type: "icmp",
      },
      {
        id: 3,
        name: "移动",
        interval: 120,
        type: "icmp",
      },
      {
        id: 4,
        name: "BGP",
        interval: 120,
        type: "icmp",
      },
    ];
  };

/* =========================================================
 * Ping 历史
 *
 * CFSM /api/servers 自带最近一小时 ping 窗口，
 * 固定约 30 个点。
 * ========================================================= */

export const getPingRecords = async (
  uuid: string,
  _hours: number,
): Promise<{
  count: number;
  records: PingRecord[];
  tasks?: PingTask[];
}> => {
  const response =
    await getJSON<ServersResponse>(
      "/api/servers",
    );

  const server =
    (response.servers || [])
      .find((item) => item.id === uuid);

  if (!server) {
    return {
      count: 0,
      records: [],
      tasks: await getPingTasks(),
    };
  }

  const records: PingRecord[] = [];

  for (const point of server.ping || []) {
    const values = [
      {
        task_id: 1,
        value: point.ct,
      },
      {
        task_id: 2,
        value: point.cu,
      },
      {
        task_id: 3,
        value: point.cm,
      },
      {
        task_id: 4,
        value: point.bd,
      },
    ];

    for (const item of values) {
      if (
        item.value !== null &&
        item.value !== undefined &&
        item.value !== false
      ) {
        records.push({
          task_id: item.task_id,
          time: new Date(
            point.ts,
          ).toISOString(),
          value: number(item.value),
        });
      }
    }
  }

  return {
    count: records.length,
    records,
    tasks: await getPingTasks(),
  };
};
