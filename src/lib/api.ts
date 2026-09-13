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

  // 注意：
  // Komari 主题这里需要的是「已使用字节数」，
  // 不是百分比。
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
  expire_date?: string | null;

  traffic_limit?: string | number;
  traffic_calc_type?: string;

  is_hidden?: string | number | boolean;

  cpu?: number | string;
  load_avg?: string;

  net_in_speed?: number | string;
  net_out_speed?: number | string;

  net_rx?: number | string;
  net_tx?: number | string;

  net_rx_monthly?: number | string;
  net_tx_monthly?: number | string;

  processes?: number | string;
  tcp_conn?: number | string;
  udp_conn?: number | string;

  ping_ct?: number | null | false;
  ping_cu?: number | null | false;
  ping_cm?: number | null | false;
  ping_bd?: number | null | false;

  loss_ct?: number | null | false;
  loss_cu?: number | null | false;
  loss_cm?: number | null | false;
  loss_bd?: number | null | false;

  ping?: Array<{
    ts: number | string;

    ct?: number | null | false;
    cu?: number | null | false;
    cm?: number | null | false;
    bd?: number | null | false;
  }>;

  loss?: Array<{
    ts: number | string;

    ct?: number | null | false;
    cu?: number | null | false;
    cm?: number | null | false;
    bd?: number | null | false;
  }>;

  ram_total?: number | string;
  ram_used?: number | string;

  swap_total?: number | string;
  swap_used?: number | string;

  disk_total?: number | string;
  disk_used?: number | string;

  disk?: {
    read_bps?: number | string;
    write_bps?: number | string;
    read_iops?: number | string;
    write_iops?: number | string;
    await_ms?: number | string;
    util?: number | string;
  };

  cpu_cores?: number | string;
  cpu_info?: string;

  gpu_info?:
    | string
    | Array<{
        id?: string;
        name?: string;
        info?: number | string;
      }>
    | null;

  arch?: string;
  os?: string;
  kernel_version?: string;

  region?: string;

  ip_v4?: string;
  ip_v6?: string;

  boot_time?: string | number;
  last_updated?: string | number;
  timestamp?: string | number;

  is_online?: boolean;
}

interface ServersResponse {
  servers: CFSMServer[];
  latestReportUpdates?: unknown[];
  stats?: unknown;
  regionStats?: unknown;
  sysConfig?: unknown;
}

/* =========================================================
 * HTTP
 * ========================================================= */

async function getJSON<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }

  return (await response.json()) as T;
}

/* =========================================================
 * 工具函数
 * ========================================================= */

function number(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);

    return Number.isFinite(parsed)
      ? parsed
      : fallback;
  }

  return fallback;
}

/**
 * CF-Server-Monitor：
 * ram_total / ram_used / disk_total / disk_used
 * 单位都是 MiB。
 */
function mbToBytes(value: unknown): number {
  return number(value) * 1024 * 1024;
}

/**
 * 时间戳统一转换成毫秒。
 *
 * 支持：
 * - Unix 秒
 * - Unix 毫秒
 * - 数字字符串
 * - ISO 8601 字符串
 */
function timestampToMs(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return value < 10_000_000_000
      ? value * 1000
      : value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const text = value.trim();

  if (!text) {
    return 0;
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const parsed = Number(text);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }

    return parsed < 10_000_000_000
      ? parsed * 1000
      : parsed;
  }

  const parsed = Date.parse(text);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function timestampToISOString(value: unknown): string {
  const ms = timestampToMs(value);

  if (!ms) {
    return new Date().toISOString();
  }

  return new Date(ms).toISOString();
}

function parseLoad(
  value: unknown,
): [number, number, number] {
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

/* =========================================================
 * 价格
 * ========================================================= */

function parsePrice(value: unknown): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const n = Number(
    String(value).replace(/,/g, ""),
  );

  return Number.isFinite(n)
    ? n
    : 0;
}

/* =========================================================
 * 计费周期
 * ========================================================= */

function billingCycleToDays(
  value: unknown,
): number {
  switch (
    String(value ?? "")
      .trim()
      .toLowerCase()
  ) {
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

/* =========================================================
 * 流量配额
 *
 * CFSM 后台 traffic_limit 默认单位是 GB。
 *
 * 例如：
 * "500.0" → 500 GB
 * "500GB" → 500 GB
 * "1TB"   → 1 TB
 * ========================================================= */

function parseTrafficLimit(
  value: unknown,
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    // CFSM 数字流量配额默认也是 GB
    return value * 1024 ** 3;
  }

  const text = String(value).trim();

  if (!text) {
    return 0;
  }

  const match = text.match(
    /^(-?[\d.]+)\s*(KB|MB|GB|TB|PB|K|M|G|T|P)?$/i,
  );

  if (!match) {
    return 0;
  }

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  const unit = (
    match[2] || "GB"
  ).toUpperCase();

  const units: Record<string, number> = {
    K: 1024,
    KB: 1024,

    M: 1024 ** 2,
    MB: 1024 ** 2,

    G: 1024 ** 3,
    GB: 1024 ** 3,

    T: 1024 ** 4,
    TB: 1024 ** 4,

    P: 1024 ** 5,
    PB: 1024 ** 5,
  };

  return amount * (
    units[unit] ?? 1024 ** 3
  );
}

/* =========================================================
 * GPU
 * ========================================================= */

function parseGpuInfo(
  server: CFSMServer,
): Array<{
  name?: string;
  info?: number | string;
}> {
  const gpu = server.gpu_info;

  if (!gpu) {
    return [];
  }

  if (typeof gpu === "string") {
    const text = gpu.trim();

    if (!text) {
      return [];
    }

    try {
      const parsed = JSON.parse(text);

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(gpu)
    ? gpu
    : [];
}

function gpuName(
  server: CFSMServer,
): string {
  return parseGpuInfo(server)
    .map((item) => item?.name || "")
    .filter(Boolean)
    .join(", ");
}

function gpuUsage(
  server: Pick<CFSMServer, "gpu_info">,
): number {
  const values = parseGpuInfo(server)
    .map((item) =>
      number(item?.info, 0),
    )
    .filter(
      (value) =>
        Number.isFinite(value),
    );

  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

/* =========================================================
 * 在线状态
 * ========================================================= */

function online(
  server: CFSMServer,
): boolean {
  if (
    typeof server.is_online ===
    "boolean"
  ) {
    return server.is_online;
  }

  const updated = timestampToMs(
    server.last_updated ??
      server.timestamp,
  );

  if (!updated) {
    return false;
  }

  return (
    Date.now() - updated <=
    5 * 60 * 1000
  );
}

/* =========================================================
 * 运行时间
 * ========================================================= */

function uptimeSeconds(
  server: CFSMServer,
): number {
  const bootMs = timestampToMs(
    server.boot_time,
  );

  if (!bootMs) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (Date.now() - bootMs) / 1000,
    ),
  );
}

/* =========================================================
 * 隐藏节点
 * ========================================================= */

function isHidden(
  server: CFSMServer,
): boolean {
  return (
    String(server.is_hidden) ===
    "1"
  );
}

/* =========================================================
 * Ping
 * ========================================================= */

interface PingPoint {
  ts: number | string;
  ct?: number | null | false;
  cu?: number | null | false;
  cm?: number | null | false;
  bd?: number | null | false;
}

function validPing(
  value: unknown,
): value is number | string {
  return (
    value !== null &&
    value !== undefined &&
    value !== false &&
    Number.isFinite(
      number(value, NaN),
    )
  );
}

function pingStatistics(
  values: number[],
): {
  latest: number;
  avg: number;
  tail: number;
  min: number;
  max: number;
} | null {
  if (values.length === 0) {
    return null;
  }

  const latest =
    values[values.length - 1] ?? 0;

  const min =
    Math.min(...values);

  const max =
    Math.max(...values);

  const avg =
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) / values.length;

  // tail 使用最后一个有效值
  const tail = latest;

  return {
    latest,
    avg,
    tail,
    min,
    max,
  };
}

function buildPingStats(
  server: CFSMServer,
): Record<string, PingStat> {
  const result: Record<
    string,
    PingStat
  > = {};

  const definitions = [
    {
      key: "ct",
      name: "电信",
      current: server.ping_ct,
      loss: server.loss_ct,
    },
    {
      key: "cu",
      name: "联通",
      current: server.ping_cu,
      loss: server.loss_cu,
    },
    {
      key: "cm",
      name: "移动",
      current: server.ping_cm,
      loss: server.loss_cm,
    },
    {
      key: "bd",
      name: "BGP",
      current: server.ping_bd,
      loss: server.loss_bd,
    },
  ];

  for (const item of definitions) {
    const values: number[] = [];

    for (
      const point of
      server.ping ?? []
    ) {
      const value =
        point[item.key as keyof PingPoint];

      if (validPing(value)) {
        values.push(
          number(value),
        );
      }
    }

    // 如果没有窗口数据，
    // 使用 /api/servers 当前值。
    if (
      values.length === 0 &&
      validPing(item.current)
    ) {
      values.push(
        number(item.current),
      );
    }

    const stats =
      pingStatistics(values);

    if (!stats) {
      continue;
    }

    result[item.key] = {
      name: item.name,

      latest: stats.latest,

      avg: stats.avg,

      tail: stats.tail,

      loss: number(
        item.loss,
        0,
      ),

      min: stats.min,

      max: stats.max,
    };
  }

  return result;
}

/* =========================================================
 * CFSM → Komari NodeInfo
 * ========================================================= */

function toNodeInfo(
  server: CFSMServer,
): NodeInfo {
  return {
    uuid: server.id,

    name: server.name,

    cpu_name:
      server.cpu_info || "",

    virtualization: "",

    arch:
      server.arch || "",

    cpu_cores:
      number(server.cpu_cores),

    os:
      server.os || "",

    gpu_name:
      gpuName(server),

    region:
      server.region || "",

    /*
     * CFSM 容量单位：
     * MB → Bytes
     */
    mem_total:
      mbToBytes(
        server.ram_total,
      ),

    swap_total:
      mbToBytes(
        server.swap_total,
      ),

    disk_total:
      mbToBytes(
        server.disk_total,
      ),

    weight:
      number(
        server.sort_order,
      ),

    price:
      parsePrice(
        server.price,
      ),

    billing_cycle:
      billingCycleToDays(
        server.billing_cycle,
      ),

    currency:
      server.currency || "",

    expired_at:
      server.expire_date
        ? `${server.expire_date} 00:00:00`
        : null,

    group:
      server.server_group ||
      "Default",

    tags:
      server.tags || "",

    hidden:
      isHidden(server),

    /*
     * traffic_limit 最终必须是 Bytes
     */
    traffic_limit:
      parseTrafficLimit(
        server.traffic_limit,
      ),

    traffic_limit_type:
      server.traffic_calc_type ||
      "total",
  };
}

/* =========================================================
 * CFSM → Komari LatestStatus
 * ========================================================= */

function toLatestStatus(
  server: CFSMServer,
): LatestStatus {
  const load =
    parseLoad(
      server.load_avg,
    );

  /*
   * CFSM 的内存/硬盘字段单位是 MB。
   *
   * 这里一定要返回「已使用 Bytes」，
   * 不能返回百分比。
   */
  const ramTotal =
    mbToBytes(
      server.ram_total,
    );

  const ramUsed =
    mbToBytes(
      server.ram_used,
    );

  const swapTotal =
    mbToBytes(
      server.swap_total,
    );

  const swapUsed =
    mbToBytes(
      server.swap_used,
    );

  const diskTotal =
    mbToBytes(
      server.disk_total,
    );

  const diskUsed =
    mbToBytes(
      server.disk_used,
    );

  return {
    client:
      server.id,

    time:
      timestampToISOString(
        server.last_updated ??
          server.timestamp,
      ),

    cpu:
      number(server.cpu),

    gpu:
      gpuUsage(server),

    /*
     * ★ 这里是本次最重要的修复
     */
    ram:
      ramUsed,

    ram_total:
      ramTotal,

    swap:
      swapUsed,

    swap_total:
      swapTotal,

    load:
      load[0],

    load5:
      load[1],

    load15:
      load[2],

    disk:
      diskUsed,

    disk_total:
      diskTotal,

    net_in:
      number(
        server.net_in_speed,
      ),

    net_out:
      number(
        server.net_out_speed,
      ),

    /*
     * net_tx = 上传累计
     * net_rx = 下载累计
     */
    net_total_up:
      number(server.net_tx),

    net_total_down:
      number(server.net_rx),

    process:
      number(server.processes),

    connections:
      number(server.tcp_conn),

    connections_udp:
      number(server.udp_conn),

    online:
      online(server),

    uptime:
      uptimeSeconds(server),

    ping:
      buildPingStats(server),
  };
}

/* =========================================================
 * 站点配置
 * ========================================================= */

export const getPublicInfo =
  async (): Promise<PublicInfo> => {
    const config =
      await getJSON<any>(
        "/api/config",
      );

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

export const getNodes =
  async (): Promise<NodeInfo[]> => {
    const response =
      await getJSON<ServersResponse>(
        "/api/servers",
      );

    return (
      response.servers || []
    )
      .filter(
        (server) =>
          !isHidden(server),
      )
      .map(toNodeInfo)
      .sort(
        (a, b) =>
          a.weight - b.weight,
      );
  };

/* =========================================================
 * 最新状态
 * ========================================================= */

export const getLatest =
  async (): Promise<
    Record<string, LatestStatus>
  > => {
    const response =
      await getJSON<ServersResponse>(
        "/api/servers",
      );

    const result: Record<
      string,
      LatestStatus
    > = {};

    for (
      const server of
      response.servers || []
    ) {
      if (isHidden(server)) {
        continue;
      }

      result[server.id] =
        toLatestStatus(server);
    }

    return result;
  };

/* =========================================================
 * 历史负载
 * ========================================================= */

export const getRecords =
  async (
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

    let selectedHours =
      allowedHours[0];

    let bestDelta =
      Number.POSITIVE_INFINITY;

    for (
      const option of
      allowedHours
    ) {
      const delta =
        Math.abs(
          option - hours,
        );

      if (delta < bestDelta) {
        bestDelta = delta;
        selectedHours = option;
      }
    }

    const rows =
      await getJSON<any[]>(
        `/api/history/all?id=${encodeURIComponent(
          uuid,
        )}&hours=${selectedHours}`,
      );

    const records:
      LoadRecord[] =
      (rows || []).map(
        (row) => {
          const ramTotal =
            mbToBytes(
              row.ram_total,
            );

          const ramUsed =
            mbToBytes(
              row.ram_used,
            );

          const swapTotal =
            mbToBytes(
              row.swap_total,
            );

          const swapUsed =
            mbToBytes(
              row.swap_used,
            );

          const diskTotal =
            mbToBytes(
              row.disk_total,
            );

          const diskUsed =
            mbToBytes(
              row.disk_used,
            );

          const load =
            parseLoad(
              row.load_avg,
            );

          return {
            time:
              timestampToISOString(
                row.timestamp,
              ),

            cpu:
              number(row.cpu),

            gpu:
              gpuUsage({
                gpu_info:
                  row.gpu_info,
              }),

            /*
             * ★ 历史数据同样必须返回已使用 Bytes
             */
            ram:
              ramUsed,

            ram_total:
              ramTotal,

            swap:
              swapUsed,

            swap_total:
              swapTotal,

            load:
              load[0],

            disk:
              diskUsed,

            disk_total:
              diskTotal,

            net_in:
              number(
                row.net_in_speed,
              ),

            net_out:
              number(
                row.net_out_speed,
              ),

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
        },
      );

    return {
      count:
        records.length,

      records,
    };
  };

/* =========================================================
 * Ping 任务
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
 * ========================================================= */

export const getPingRecords =
  async (
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
      (
        response.servers || []
      ).find(
        (item) =>
          item.id === uuid,
      );

    if (!server) {
      return {
        count: 0,
        records: [],
        tasks:
          await getPingTasks(),
      };
    }

    const records:
      PingRecord[] = [];

    for (
      const point of
      server.ping || []
    ) {
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

      for (
        const item of values
      ) {
        if (
          !validPing(
            item.value,
          )
        ) {
          continue;
        }

        records.push({
          task_id:
            item.task_id,

          time:
            timestampToISOString(
              point.ts,
            ),

          value:
            number(
              item.value,
            ),
        });
      }
    }

    return {
      count:
        records.length,

      records,

      tasks:
        await getPingTasks(),
    };
  };
