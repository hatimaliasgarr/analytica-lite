import { aggregateDashboard } from "./engine/aggregator.js";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  toNumber,
} from "./engine/formatter.js";
import { renderRevenueBarChart } from "./charts/bar-chart.js";
import { renderMiniLineChart, renderTrendLineChart } from "./charts/line-chart.js";
import { renderDonutChart } from "./charts/donut-chart.js";
import { renderSparkline } from "./charts/sparkline.js";

const FILTER_LABELS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "3m": "Last 3 Months",
  "6m": "Last 6 Months",
  "1y": "Last Year",
  all: "All time",
};

const DEFAULT_THEME = {
  accent: "#3DAA7A",
  barPrimary: "#74C69D",
  barSecondary: "#B7E4C7",
  trend: "#F4A261",
};

const THEME_PRESETS = {
  green: DEFAULT_THEME,
  blue: {
    accent: "#2F80ED",
    barPrimary: "#56CCF2",
    barSecondary: "#BDEBFF",
    trend: "#F2994A",
  },
  rose: {
    accent: "#D9467A",
    barPrimary: "#F472B6",
    barSecondary: "#FBCFE8",
    trend: "#0EA5A4",
  },
};

export function applyDashboardTheme(theme = null) {
  ensureState();
  const nextTheme = { ...DEFAULT_THEME, ...(theme || window.__dataLens.theme || {}) };
  window.__dataLens.theme = nextTheme;

  const root = document.documentElement;
  root.style.setProperty("--accent", nextTheme.accent);
  root.style.setProperty("--accent-hover", shadeHex(nextTheme.accent, -16));
  root.style.setProperty("--accent-light", hexToRgba(nextTheme.accent, 0.12));
  root.style.setProperty("--accent-border", hexToRgba(nextTheme.accent, 0.35));
  root.style.setProperty("--chart-bar-primary", nextTheme.barPrimary);
  root.style.setProperty("--chart-bar-secondary", nextTheme.barSecondary);
  root.style.setProperty("--chart-line-trend", nextTheme.trend);
  root.style.setProperty("--chart-sparkline", nextTheme.accent);
  root.style.setProperty("--sidebar-active-dot", nextTheme.barPrimary);
  window.dispatchEvent(new CustomEvent("datalens:theme-updated"));
}

export async function buildDashboard(rows, mapping) {
  ensureState();
  window.__dataLens.rows = rows;
  window.__dataLens.mapping = mapping;

  const contentRoot = document.getElementById("content-root");
  const template = await loadDashboardTemplate();
  destroyCharts();
  contentRoot.innerHTML = "";
  contentRoot.appendChild(template.content.cloneNode(true));
  applyDashboardTheme(window.__dataLens.theme);
  configureChartDefaults();
  bindDashboardInteractions();
  renderDashboard();
}

export function renderDashboard() {
  ensureState();
  const state = window.__dataLens;
  if (!state.rows || !state.mapping) {
    return;
  }

  destroyCharts();
  const filter = state.dateFilter || "all";
  const period = state.period || "month";
  const data = aggregateDashboard(state.rows, state.mapping, filter, period);
  state.dashboardData = data;
  state.charts = {};

  updateFilterLabels(filter);
  updatePeriodButtons(period, filter);
  renderKpis(data, state.mapping);
  renderCustomKpiControls(state);
  renderCustomKpis(data, state);
  syncThemeControls();
  renderRevenueChart(data);
  renderLineCharts(data);
  renderDonuts(data, state.mapping);
  renderLists(data, state.mapping);
}

export function destroyCharts() {
  ensureState();
  Object.values(window.__dataLens.charts || {}).forEach((chart) => {
    if (chart && typeof chart.destroy === "function") {
      chart.destroy();
    }
  });
  window.__dataLens.charts = {};
}

export function configureChartDefaults() {
  if (!window.Chart) {
    return;
  }

  window.Chart.defaults.font.family = "'Inter', sans-serif";
  window.Chart.defaults.font.size = 12;
  window.Chart.defaults.color = "#52796F";
  window.Chart.defaults.plugins.legend.display = false;
  window.Chart.defaults.plugins.tooltip.backgroundColor = "#FFFFFF";
  window.Chart.defaults.plugins.tooltip.titleColor = "#1B4332";
  window.Chart.defaults.plugins.tooltip.bodyColor = "#52796F";
  window.Chart.defaults.plugins.tooltip.borderColor = "#DDF0E4";
  window.Chart.defaults.plugins.tooltip.borderWidth = 1;
  window.Chart.defaults.plugins.tooltip.padding = 10;
  window.Chart.defaults.plugins.tooltip.cornerRadius = 8;
  window.Chart.defaults.scale.grid.color = "rgba(0,0,0,0.04)";
  window.Chart.defaults.scale.border.display = false;
  window.Chart.defaults.scale.ticks.padding = 8;
}

export function exportKpisAsCsv() {
  const data = window.__dataLens?.dashboardData;
  if (!data?.kpis) {
    throw new Error("No KPI data is available to export.");
  }

  const kpis = data.kpis;
  const rows = [
    ["metric", "value"],
    ["totalRevenue", kpis.totalRevenue],
    ["totalOrders", kpis.totalOrders],
    ["avgOrderValue", kpis.avgOrderValue],
    ["avgRating", kpis.avgRating ?? ""],
    ["topRegion", kpis.topRegion ?? ""],
    ["topCategory", kpis.topCategory ?? ""],
    ["deliveredCount", kpis.deliveredCount],
    ["returnRate", kpis.returnRate],
    ["revenueGrowth", kpis.revenueGrowth],
    ["ordersGrowth", kpis.ordersGrowth],
  ];
  getCustomKpiResults(window.__dataLens).forEach((item) => {
    rows.push([item.label, item.rawValue]);
  });
  downloadBlob(toCsv(rows), "datalens-kpis.csv", "text/csv;charset=utf-8");
}

export function exportFullDataAsCsv() {
  const rows = window.__dataLens?.rows;
  if (!rows?.length) {
    throw new Error("No row data is available to export.");
  }

  const csv = window.Papa ? window.Papa.unparse(rows) : objectsToCsv(rows);
  downloadBlob(csv, "datalens-data.csv", "text/csv;charset=utf-8");
}

export async function exportDashboardAsPng() {
  const target = document.getElementById("content-root");
  if (!target) {
    throw new Error("Dashboard content is not available.");
  }

  if (window.html2canvas) {
    const canvas = await window.html2canvas(target, { backgroundColor: "#EBF5EE" });
    downloadDataUrl(canvas.toDataURL("image/png"), "datalens-dashboard.png");
    return;
  }

  const firstChart = Object.values(window.__dataLens?.charts || {})[0];
  if (!firstChart) {
    throw new Error("No chart is available to export.");
  }
  downloadDataUrl(firstChart.toBase64Image(), "datalens-chart.png");
}

function renderKpis(data, mapping) {
  const { kpis } = data;
  setText("kpi-total-revenue", formatCurrency(kpis.totalRevenue, false));
  setText("kpi-total-orders", formatNumber(kpis.totalOrders, false));
  setText("kpi-aov", formatCurrency(kpis.avgOrderValue, false));
  setText("kpi-avg-rating", kpis.avgRating === null ? "N/A" : kpis.avgRating.toFixed(1));
  setText("detail-orders", formatNumber(kpis.totalOrders));
  setText("detail-rating", kpis.avgRating === null ? "N/A" : kpis.avgRating.toFixed(1));
  setText("detail-region", kpis.topRegion ? truncate(kpis.topRegion, 8) : "N/A");

  const sparkline = data.sparklineRevenue;
  renderSparkline(document.getElementById("spark-total-revenue"), sparkline);
  renderSparkline(document.getElementById("spark-total-orders"), sparkline.map((value, index) => value + index));
  renderSparkline(document.getElementById("spark-aov"), sparkline.map((value) => value / Math.max(1, kpis.totalOrders)));
  renderSparkline(document.getElementById("spark-rating"), sparkline.map(() => kpis.avgRating || 0));

  document.getElementById("rating-metric-cell").hidden = !mapping.rating;
}

function renderCustomKpiControls(state) {
  const field = document.getElementById("custom-kpi-field");
  if (!field) return;

  const currentValue = field.value;
  const columns = getMetricColumns(state.rows, state.mapping, state.columns);
  field.innerHTML = columns
    .map((column) => `<option value="${escapeAttribute(column)}">${escapeHtml(column)}</option>`)
    .join("");
  if (columns.includes(currentValue)) {
    field.value = currentValue;
  }

  const addButton = document.getElementById("add-custom-kpi");
  if (addButton) {
    addButton.disabled = columns.length === 0;
  }
  const colorInput = document.getElementById("custom-kpi-color");
  if (colorInput && !colorInput.dataset.userSelected) {
    colorInput.value = state.theme?.accent || DEFAULT_THEME.accent;
  }
}

function renderCustomKpis(data, state) {
  const grid = document.getElementById("custom-kpi-grid");
  const empty = document.getElementById("custom-kpi-empty");
  if (!grid || !empty) return;

  const results = getCustomKpiResults(state, data.rows);
  grid.innerHTML = "";
  empty.hidden = results.length > 0;
  grid.hidden = results.length === 0;

  results.forEach((item) => {
    const card = document.createElement("article");
    card.className = "custom-kpi-card";
    card.style.setProperty("--custom-kpi-color", item.color);
    card.innerHTML = `
      <button class="custom-kpi-remove" type="button" data-remove-custom-kpi="${escapeAttribute(item.id)}" aria-label="Remove ${escapeAttribute(item.label)}">x</button>
      <span>${escapeHtml(item.aggregationLabel)}</span>
      <strong>${escapeHtml(item.value)}</strong>
      <em>${escapeHtml(item.label)}</em>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll("[data-remove-custom-kpi]").forEach((button) => {
    button.addEventListener("click", () => {
      state.customKpis = (state.customKpis || []).filter((item) => item.id !== button.dataset.removeCustomKpi);
      renderDashboard();
    });
  });
}

function renderRevenueChart(data) {
  const canvas = document.getElementById("revenue-overview-chart");
  if (!canvas) return;
  window.__dataLens.charts.revenueOverview = renderRevenueBarChart(canvas, data.revenueByPeriod);
}

function renderLineCharts(data) {
  const miniCanvas = document.getElementById("overview-line-chart");
  const trendsCanvas = document.getElementById("trends-line-chart");
  const revenueSeries = data.revenueByPeriod;
  const orderSeries = data.revenueByPeriod.map((_item, index) => data.rows.slice(0, index + 1).length);

  if (miniCanvas) {
    window.__dataLens.charts.overviewLine = renderMiniLineChart(miniCanvas, revenueSeries);
  }
  if (trendsCanvas) {
    window.__dataLens.charts.trendsLine = renderTrendLineChart(trendsCanvas, revenueSeries, orderSeries);
  }
}

function renderDonuts(data, mapping) {
  const donutRow = document.getElementById("category-donuts");
  const empty = document.getElementById("category-empty");
  if (!donutRow || !empty) return;

  if (!mapping.category || !data.topCategories.length) {
    donutRow.hidden = true;
    empty.hidden = false;
    return;
  }

  donutRow.hidden = false;
  empty.hidden = true;
  const colors = ["--chart-donut-1", "--chart-donut-2", "--chart-donut-3"];
  data.topCategories.slice(0, 3).forEach((item, index) => {
    const canvas = document.getElementById(`category-donut-${index + 1}`);
    if (canvas) {
      window.__dataLens.charts[`categoryDonut${index + 1}`] = renderDonutChart(canvas, item, colors[index]);
    }
  });
}

function renderLists(data, mapping) {
  renderRankList({
    listId: "top-category-list",
    placeholderId: "top-category-placeholder",
    rows: data.topCategories,
    enabled: Boolean(mapping.category),
    valueFormatter: (value) => formatCurrency(value),
  });
  renderRankList({
    listId: "top-region-list",
    placeholderId: "top-region-placeholder",
    rows: data.topRegions.slice(0, 5),
    enabled: Boolean(mapping.region),
    valueFormatter: (value) => formatCurrency(value),
  });
}

function renderRankList({ listId, placeholderId, rows, enabled, valueFormatter }) {
  const list = document.getElementById(listId);
  const placeholder = document.getElementById(placeholderId);
  if (!list || !placeholder) return;

  list.innerHTML = "";
  placeholder.hidden = enabled && rows.length > 0;
  list.hidden = !enabled || rows.length === 0;
  if (!enabled || rows.length === 0) return;

  rows.slice(0, 5).forEach((row) => {
    const item = document.createElement("li");
    const span = document.createElement("span");
    const label = document.createElement("strong");
    const value = document.createElement("em");
    label.textContent = truncate(row.label, 16);
    value.textContent = valueFormatter(row.value);
    span.append(label, value);
    item.appendChild(span);
    list.appendChild(item);
  });
}

function bindDashboardInteractions() {
  document.querySelectorAll(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach((tab) => tab.classList.toggle("is-active", tab === button));
      document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.tabPanel !== tabName;
      });
      renderDashboard();
    });
  });

  document.querySelectorAll(".toggle").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("is-on");
      const sparkline = button.closest(".metric-cell")?.querySelector(".sparkline");
      if (sparkline) {
        sparkline.hidden = !button.classList.contains("is-on");
      }
    });
  });

  document.querySelectorAll(".go-mapper").forEach((button) => {
    button.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("datalens:mapper-requested"));
    });
  });

  document.querySelectorAll("[data-open-date-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById("date-filter-btn")?.click();
    });
  });

  document.querySelectorAll("[data-period]").forEach((button) => {
    button.addEventListener("click", () => {
      window.__dataLens.period = button.dataset.period;
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-filter-short]").forEach((button) => {
    button.addEventListener("click", () => {
      window.__dataLens.dateFilter = button.dataset.filterShort;
      const label = document.getElementById("date-filter-label");
      if (label) {
        label.textContent = FILTER_LABELS[window.__dataLens.dateFilter] || FILTER_LABELS.all;
      }
      renderDashboard();
    });
  });

  document.getElementById("add-custom-kpi")?.addEventListener("click", () => {
    const field = document.getElementById("custom-kpi-field");
    const aggregation = document.getElementById("custom-kpi-aggregation");
    const label = document.getElementById("custom-kpi-label");
    const color = document.getElementById("custom-kpi-color");
    if (!field?.value) return;

    const next = {
      id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      field: field.value,
      aggregation: aggregation?.value || "sum",
      label: label?.value.trim() || titleFromColumn(field.value),
      color: color?.value || window.__dataLens.theme?.accent || DEFAULT_THEME.accent,
    };
    window.__dataLens.customKpis = [...(window.__dataLens.customKpis || []), next];
    if (label) label.value = "";
    renderDashboard();
  });

  document.getElementById("custom-kpi-color")?.addEventListener("input", (event) => {
    event.currentTarget.dataset.userSelected = "true";
  });

  bindThemeControls();
}

function updateFilterLabels(filter) {
  const label = FILTER_LABELS[filter] || FILTER_LABELS.all;
  document.querySelectorAll("[data-current-filter]").forEach((element) => {
    element.textContent = label;
  });
}

function updatePeriodButtons(period, filter) {
  document.querySelectorAll("[data-period]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.period === period);
  });
  document.querySelectorAll("[data-filter-short]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filterShort === filter);
  });
}

function bindThemeControls() {
  document.querySelectorAll("[data-theme-color]").forEach((input) => {
    input.addEventListener("input", () => {
      const theme = { ...DEFAULT_THEME, ...(window.__dataLens.theme || {}) };
      theme[input.dataset.themeColor] = input.value;
      applyDashboardTheme(theme);
      updateThemeCodeLabels();
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-palette]").forEach((button) => {
    button.addEventListener("click", () => {
      applyDashboardTheme({ ...THEME_PRESETS[button.dataset.palette] });
      syncThemeControls();
      renderDashboard();
    });
  });
}

function syncThemeControls() {
  const theme = { ...DEFAULT_THEME, ...(window.__dataLens.theme || {}) };
  document.querySelectorAll("[data-theme-color]").forEach((input) => {
    const value = theme[input.dataset.themeColor] || DEFAULT_THEME[input.dataset.themeColor];
    input.value = value;
  });
  updateThemeCodeLabels();
}

function updateThemeCodeLabels() {
  document.querySelectorAll("[data-theme-color]").forEach((input) => {
    input.closest(".color-code-field")?.querySelector("code")?.replaceChildren(input.value);
  });
}

function getMetricColumns(rows, mapping = {}, knownColumns = null) {
  const columns = knownColumns || Object.keys(rows?.[0] || {});
  return columns.filter((column) => {
    if ([mapping.revenue, mapping.quantity, mapping.rating, ...(mapping.metrics || [])].includes(column)) {
      return true;
    }
    const sample = (rows || [])
      .slice(0, 80)
      .map((row) => row[column])
      .filter((value) => value !== null && value !== undefined && value !== "");
    if (!sample.length) return false;
    const numericCount = sample.filter(isNumericLike).length;
    return numericCount / sample.length > 0.8;
  });
}

function isNumericLike(value) {
  const text = String(value ?? "").trim();
  return /\d/.test(text) && Number.isFinite(toNumber(text));
}

function getCustomKpiResults(state, scopedRows = null) {
  const rows = scopedRows || state.dashboardData?.rows || state.rows || [];
  return (state.customKpis || [])
    .filter((item) => item.field)
    .map((item) => {
      const rawValue = aggregateCustomKpi(rows, item.field, item.aggregation);
      return {
        ...item,
        rawValue,
        value: formatCustomKpiValue(rawValue, item),
        aggregationLabel: aggregationLabel(item.aggregation),
      };
    });
}

function aggregateCustomKpi(rows, field, aggregation) {
  const rawValues = rows
    .map((row) => row[field])
    .filter((value) => value !== null && value !== undefined && value !== "");
  const values = rawValues.map(toNumber).filter((value) => Number.isFinite(value));
  if (aggregation === "count") return rawValues.length;
  if (!values.length) return 0;
  if (aggregation === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "min") return Math.min(...values);
  if (aggregation === "max") return Math.max(...values);
  return values.reduce((sum, value) => sum + value, 0);
}

function formatCustomKpiValue(value, item) {
  const field = String(item.field || "").toLowerCase();
  if (/(price|revenue|amount|sales|total|value|freight|income|payment)/.test(field)) {
    return formatCurrency(value, false);
  }
  return item.aggregation === "count" ? formatNumber(value, false) : formatNumber(value, false);
}

function aggregationLabel(aggregation) {
  const labels = {
    avg: "Average",
    count: "Count",
    max: "Maximum",
    min: "Minimum",
    sum: "Sum",
  };
  return labels[aggregation] || labels.sum;
}

function titleFromColumn(column) {
  return String(column)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadDashboardTemplate() {
  const response = await fetch("./dashboard.html");
  if (!response.ok) {
    throw new Error(`Could not load dashboard template: HTTP ${response.status}`);
  }
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const template = doc.getElementById("dashboard-template");
  if (!template) {
    throw new Error("Dashboard template was not found.");
  }
  return template;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function truncate(value, length) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function shadeHex(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const shade = (channel) => Math.max(0, Math.min(255, channel + amount));
  return rgbToHex(shade(rgb.r), shade(rgb.g), shade(rgb.b));
}

function hexToRgba(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(61, 170, 122, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureState() {
  window.__dataLens = window.__dataLens || {
    rows: null,
    columns: null,
    mapping: null,
    charts: {},
    dateFilter: "all",
    period: "month",
    customKpis: [],
    theme: { ...DEFAULT_THEME },
  };
  window.__dataLens.charts = window.__dataLens.charts || {};
  window.__dataLens.customKpis = window.__dataLens.customKpis || [];
  window.__dataLens.theme = { ...DEFAULT_THEME, ...(window.__dataLens.theme || {}) };
  window.__dataLens.period = window.__dataLens.period || "month";
}

function toCsv(rows) {
  return rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

function objectsToCsv(rows) {
  const columns = Object.keys(rows[0] || {});
  return toCsv([
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? "")),
  ]);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
