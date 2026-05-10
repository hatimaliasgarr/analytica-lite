import { parseCSV, parseCSVText } from "./parsers/csv-parser.js";
import { parseExcel } from "./parsers/excel-parser.js";
import { parseJSON, parseJSONString } from "./parsers/json-parser.js";
import { fetchFromSupabase } from "./parsers/supabase-fetcher.js";
import { fetchFromFirebase } from "./parsers/firebase-fetcher.js";
import { detectColumns, getRoleOptions } from "./engine/column-detector.js";
import { aggregateDashboard } from "./engine/aggregator.js";
import { formatCurrency, formatNumber, formatPercent } from "./engine/formatter.js";
import {
  applyDashboardTheme,
  buildDashboard,
  destroyCharts,
  exportDashboardAsPng,
  exportFullDataAsCsv,
  exportKpisAsCsv,
  renderDashboard,
} from "./dashboard.js";

window.__dataLens = {
  rows: null,
  columns: null,
  mapping: null,
  charts: {},
  dateFilter: "all",
  dashboardData: null,
  period: "month",
  customKpis: [],
  theme: null,
};

const FILTER_LABELS = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "3m": "Last 3 Months",
  "6m": "Last 6 Months",
  "1y": "Last Year",
  all: "All time",
};

const SINGLETON_ROLES = new Set(["date", "revenue", "quantity", "status", "category", "region", "rating", "id"]);

const THEME_PRESETS = {
  green: {
    accent: "#3DAA7A",
    barPrimary: "#74C69D",
    barSecondary: "#B7E4C7",
    trend: "#F4A261",
  },
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

const DEFAULT_THEME = THEME_PRESETS.green;

const contentRoot = document.getElementById("content-root");
const initialContent = contentRoot.innerHTML;
let currentStep = "source";
let currentSource = "file";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function init() {
  applyDashboardTheme(window.__dataLens.theme);
  bindShell();
  bindUploadFlow();
  goToStep("source");
}

function bindShell() {
  document.getElementById("sidebar-toggle").addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
  });

  document.getElementById("mobile-menu").addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });

  document.querySelectorAll("[data-nav]").forEach((item) => {
    item.addEventListener("click", () => {
      navigateTo(item.dataset.route || item.dataset.targetStep || item.dataset.nav.toLowerCase());
      document.body.classList.remove("sidebar-open");
    });
  });

  bindDateFilter();
  bindExportMenu();
  bindResetModal();
  bindUtilityMenus();
  bindGlobalSearch();

  window.addEventListener("datalens:mapper-requested", () => {
    restoreWizard();
    goToStep("mapper");
    if (window.__dataLens.columns && window.__dataLens.rows) {
      renderColumnMapper(window.__dataLens.columns, window.__dataLens.rows.slice(0, 50));
    }
  });

  window.addEventListener("datalens:theme-updated", () => {
    syncThemeControls(document);
  });
}

function bindUploadFlow() {
  document.querySelectorAll("[data-source]").forEach((card) => {
    card.addEventListener("click", () => selectSource(card.dataset.source));
  });

  bindDropzone();
  bindConnectorForms();
  bindMapperButtons();
}

function restoreWizard() {
  if (!document.querySelector("[data-step-panel='source']")) {
    contentRoot.innerHTML = initialContent;
    bindUploadFlow();
  }
}

function selectSource(source) {
  currentSource = source;
  document.querySelectorAll("[data-source]").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.source === source);
  });
  document.querySelectorAll("[data-source-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.sourcePanel !== source;
  });
}

function bindDropzone() {
  const dropzone = document.getElementById("dropzone");
  const input = document.getElementById("file-input");
  const browse = document.getElementById("browse-btn");
  if (!dropzone || !input || !browse) return;

  browse.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

async function handleFile(file) {
  try {
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("File is larger than the 50MB limit.");
    }

    showProgress();
    const parsed = await parseFile(file);
    showProgress(100);
    loadParsedData(parsed, file.name);
  } catch (error) {
    showFileError(error.message);
  }
}

async function parseFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "csv") return parseCSV(file);
  if (extension === "tsv") return parseCSV(file, "\t");
  if (extension === "xlsx" || extension === "xls") return parseExcel(file);
  if (extension === "json") return parseJSON(file);
  throw new Error("Unsupported file type. Upload CSV, TSV, Excel, or JSON.");
}

function bindConnectorForms() {
  const supabaseForm = document.querySelector("[data-source-panel='supabase']");
  const firebaseForm = document.querySelector("[data-source-panel='firebase']");
  const urlForm = document.querySelector("[data-source-panel='url']");

  supabaseForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(supabaseForm);
    await handleConnectorSubmit(supabaseForm, () => fetchFromSupabase({
      url: form.get("url"),
      anonKey: form.get("anonKey"),
      table: form.get("table"),
      limit: form.get("limit") || 10000,
    }), "Supabase");
  });

  firebaseForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(firebaseForm);
    await handleConnectorSubmit(firebaseForm, () => fetchFromFirebase({
      config: form.get("config"),
      collection: form.get("collection"),
      whereClause: form.get("whereClause"),
    }), "Firebase");
  });

  urlForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(urlForm);
    await handleConnectorSubmit(urlForm, () => fetchPublicUrl({
      url: form.get("url"),
      format: form.get("format"),
    }), "Public URL");
  });
}

async function handleConnectorSubmit(form, fetcher, label) {
  const message = form.querySelector("[data-form-message]");
  setMessage(message, "Fetching data...", "success");
  try {
    const parsed = await fetcher();
    setMessage(message, `Connected - ${parsed.rows.length.toLocaleString()} rows fetched`, "success");
    await sleep(350);
    loadParsedData(parsed, label);
  } catch (error) {
    const text = error instanceof TypeError
      ? "The server at this URL doesn't allow browser access. Try downloading the file and uploading it instead."
      : error.message;
    setMessage(message, text, "error");
  }
}

async function fetchPublicUrl({ url, format }) {
  if (!url) {
    throw new Error("URL is required.");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed: HTTP ${response.status}`);
  }
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const resolvedFormat = format === "auto"
    ? inferRemoteFormat(url, contentType)
    : format;

  if (resolvedFormat === "json") {
    return parseJSONString(text);
  }
  return parseCSVText(text, url.toLowerCase().endsWith(".tsv") ? "\t" : "");
}

function inferRemoteFormat(url, contentType) {
  if (contentType.includes("json") || url.toLowerCase().endsWith(".json")) {
    return "json";
  }
  return "csv";
}

function loadParsedData({ rows, columns }, sourceName) {
  if (!rows.length || !columns.length) {
    throw new Error("No tabular rows were found in this data source.");
  }

  window.__dataLens.rows = rows;
  window.__dataLens.columns = columns;
  showRowCountBadge(sourceName, rows.length, columns.length);
  setTimeout(() => {
    goToStep("mapper");
    renderColumnMapper(columns, rows.slice(0, 50));
  }, 400);
}

function renderColumnMapper(columns, sampleRows) {
  const body = document.getElementById("mapper-body");
  const summary = document.getElementById("dataset-summary");
  const detected = detectColumns(columns, sampleRows);
  const selectedRoles = selectAutoRoles(columns, detected);
  body.innerHTML = "";
  summary.textContent = `${window.__dataLens.rows.length.toLocaleString()} rows · ${columns.length.toLocaleString()} columns loaded`;

  columns.forEach((column) => {
    const role = detected[column];
    const selectedRole = selectedRoles[column] || "ignore";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="column-name"></span></td>
      <td><div class="sample-values"></div></td>
      <td><span class="role-pill role-${role}">${roleLabel(role)}</span></td>
      <td><select data-column="${escapeAttribute(column)}" data-detected-role="${role}">${roleOptions(selectedRole)}</select></td>
      <td><span class="status-muted" data-status>—</span></td>
    `;
    row.querySelector(".column-name").textContent = column;
    const samples = row.querySelector(".sample-values");
    sampleValues(column, sampleRows).forEach((value) => {
      const badge = document.createElement("span");
      badge.className = "sample-badge";
      badge.textContent = value;
      samples.appendChild(badge);
    });
    body.appendChild(row);
  });

  body.querySelectorAll("select").forEach((select) => {
    select.addEventListener("change", updateMapperValidity);
  });
  updateMapperValidity();
}

function selectAutoRoles(columns, detected) {
  const selected = {};
  const used = new Set();
  columns.forEach((column) => {
    const role = detected[column] || "ignore";
    if (role === "ignore") {
      selected[column] = "ignore";
      return;
    }
    if (role === "metric") {
      selected[column] = "metric";
      return;
    }
    if (SINGLETON_ROLES.has(role) && used.has(role)) {
      selected[column] = "ignore";
      return;
    }
    selected[column] = role;
    used.add(role);
  });
  return selected;
}

function applyAutoMappingFromDetection() {
  const selects = [...document.querySelectorAll("#mapper-body select")];
  const detected = Object.fromEntries(
    selects.map((select) => [select.dataset.column, select.dataset.detectedRole || "ignore"]),
  );
  const selectedRoles = selectAutoRoles(selects.map((select) => select.dataset.column), detected);
  selects.forEach((select) => {
    select.value = selectedRoles[select.dataset.column] || "ignore";
  });
  updateMapperValidity();
}

function roleOptions(selected) {
  return getRoleOptions()
    .map((role) => `<option value="${role}" ${role === selected ? "selected" : ""}>${roleLabel(role)}</option>`)
    .join("");
}

function sampleValues(column, rows) {
  const values = rows
    .map((row) => row[column])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .slice(0, 3)
    .map((value) => String(value).slice(0, 22));
  return values.length ? values : ["empty"];
}

function collectMappingFromUI() {
  const mapping = { metrics: [] };
  document.querySelectorAll("#mapper-body select").forEach((select) => {
    if (select.value === "metric") {
      mapping.metrics.push(select.dataset.column);
    } else if (select.value !== "ignore" && !mapping[select.value]) {
      mapping[select.value] = select.dataset.column;
    }
  });
  return mapping;
}

function updateMapperValidity() {
  const mapping = collectMappingFromUI();
  const hasRequired = Boolean(mapping.date && mapping.revenue);
  const generate = document.getElementById("generate-dashboard");
  const warning = document.getElementById("mapper-warning");
  if (generate) generate.disabled = !hasRequired;
  if (warning) warning.hidden = hasRequired;

  document.querySelectorAll("#mapper-body tr").forEach((row) => {
    const select = row.querySelector("select");
    const status = row.querySelector("[data-status]");
    const value = select.value;
    if ((value === "date" && mapping.date === select.dataset.column) || (value === "revenue" && mapping.revenue === select.dataset.column)) {
      status.textContent = "✓ Required";
      status.className = "status-ok";
    } else if ((value === "date" && mapping.date !== select.dataset.column) || (value === "revenue" && mapping.revenue !== select.dataset.column)) {
      status.textContent = "Already mapped";
      status.className = "status-warn";
    } else if (value === "metric") {
      status.textContent = "Custom KPI-ready";
      status.className = "status-ok";
    } else if (value !== "ignore") {
      status.textContent = "✓ Optional";
      status.className = "status-ok";
    } else {
      status.textContent = "—";
      status.className = "status-muted";
    }
  });
}

function bindMapperButtons() {
  document.getElementById("back-to-source")?.addEventListener("click", () => goToStep("source"));
  document.getElementById("auto-map-btn")?.addEventListener("click", applyAutoMappingFromDetection);
  document.getElementById("clear-map-btn")?.addEventListener("click", () => {
    document.querySelectorAll("#mapper-body select").forEach((select) => {
      select.value = "ignore";
    });
    updateMapperValidity();
  });
  document.getElementById("generate-dashboard")?.addEventListener("click", async () => {
    const mapping = collectMappingFromUI();
    if (!mapping.date || !mapping.revenue) {
      updateMapperValidity();
      return;
    }

    window.__dataLens.mapping = mapping;
    goToStep("building");
    await sleep(600);
    await buildDashboard(window.__dataLens.rows, mapping);
    setActiveNav("Dashboard");
    setPageTitle("Dashboard");
    currentStep = "dashboard";
  });
}

function navigateTo(route) {
  const target = String(route || "").toLowerCase();
  if (target === "source" || target === "upload") {
    goToStep("source");
    return;
  }
  if (target === "mapper") {
    if (!window.__dataLens.columns || !window.__dataLens.rows) {
      goToStep("source");
      return;
    }
    restoreWizard();
    goToStep("mapper");
    renderColumnMapper(window.__dataLens.columns, window.__dataLens.rows.slice(0, 50));
    return;
  }
  if (target === "dashboard") {
    if (window.__dataLens.mapping) {
      showDashboard();
    } else {
      renderDashboardEmptyPage();
    }
    return;
  }
  if (target === "reports") {
    renderReportsPage();
    return;
  }
  if (target === "settings") {
    renderSettingsPage();
    return;
  }
  if (target === "help") {
    renderHelpPage();
  }
}

async function showDashboard() {
  if (!window.__dataLens.rows || !window.__dataLens.mapping) {
    renderDashboardEmptyPage();
    return;
  }
  if (!document.querySelector(".dashboard-grid")) {
    await buildDashboard(window.__dataLens.rows, window.__dataLens.mapping);
  } else {
    goToStep("dashboard");
  }
  setPageTitle("Dashboard");
  setActiveNav("Dashboard");
  currentStep = "dashboard";
}

function renderDashboardEmptyPage() {
  destroyCharts();
  setPageTitle("Dashboard");
  setActiveNav("Dashboard");
  currentStep = "dashboard";
  contentRoot.innerHTML = `
    <section class="route-page">
      <article class="route-hero">
        <div>
          <p class="eyebrow">Dashboard ready</p>
          <h2>Upload data and auto-map fields to generate charts.</h2>
          <p>The dashboard will unlock as soon as one date field and one revenue field are mapped.</p>
        </div>
        <div class="route-actions">
          <button class="primary-btn" type="button" data-route="upload">Choose data</button>
          <button class="secondary-btn" type="button" data-route="help">View guide</button>
        </div>
      </article>
      <div class="interface-grid">
        ${interfaceCard("Auto Mapping", "Detects dates, revenue, regions, categories, ratings, and reusable metric fields.")}
        ${interfaceCard("Custom KPIs", "Add sum, average, count, min, and max cards from any numeric field after mapping.")}
        ${interfaceCard("Color Codes", "Tune accent, bar, and trend colors directly from the dashboard or settings.")}
      </div>
    </section>
  `;
  bindRouteActions(contentRoot);
}

function renderReportsPage() {
  const data = getCurrentReportData();
  setPageTitle("Reports");
  setActiveNav("Reports");
  currentStep = "reports";

  if (!data) {
    contentRoot.innerHTML = `
      <section class="route-page">
        <article class="route-hero">
          <div>
            <p class="eyebrow">Reports</p>
            <h2>Reports will be ready after your first dashboard is generated.</h2>
            <p>Upload a file, review the auto-map, then return here for downloadable KPI and performance summaries.</p>
          </div>
          <div class="route-actions">
            <button class="primary-btn" type="button" data-route="upload">Upload data</button>
          </div>
        </article>
      </section>
    `;
    bindRouteActions(contentRoot);
    return;
  }

  const { kpis } = data;
  contentRoot.innerHTML = `
    <section class="route-page">
      <article class="route-hero compact">
        <div>
          <p class="eyebrow">Reports</p>
          <h2>Executive summary</h2>
          <p>${data.rows.length.toLocaleString()} rows in the current ${FILTER_LABELS[window.__dataLens.dateFilter] || FILTER_LABELS.all} view.</p>
        </div>
        <div class="route-actions">
          <button class="secondary-btn" type="button" data-export-action="kpis">Export KPIs</button>
          <button class="secondary-btn" type="button" data-export-action="data">Export data</button>
          <button class="primary-btn" type="button" data-route="dashboard">Open dashboard</button>
        </div>
      </article>
      <div class="report-grid">
        ${reportMetric("Total revenue", formatCurrency(kpis.totalRevenue, false))}
        ${reportMetric("Total orders", formatNumber(kpis.totalOrders, false))}
        ${reportMetric("Avg order value", formatCurrency(kpis.avgOrderValue, false))}
        ${reportMetric("Return rate", formatPercent(kpis.returnRate))}
      </div>
      <div class="interface-grid two-col">
        ${reportList("Top categories", data.topCategories)}
        ${reportList("Top regions", data.topRegions)}
      </div>
    </section>
  `;
  bindRouteActions(contentRoot);
}

function renderSettingsPage() {
  setPageTitle("Settings");
  setActiveNav("Settings");
  currentStep = "settings";
  contentRoot.innerHTML = `
    <section class="route-page">
      <article class="route-hero compact">
        <div>
          <p class="eyebrow">Settings</p>
          <h2>Dashboard customization</h2>
          <p>Set the color codes used by KPI cards, charts, buttons, and trend lines.</p>
        </div>
        <div class="route-actions">
          <button class="secondary-btn" type="button" data-route="upload">Change source</button>
          <button class="primary-btn" type="button" data-route="dashboard">View dashboard</button>
        </div>
      </article>
      ${themePanelMarkup("settings")}
      <article class="settings-panel">
        <h3>Mapping tools</h3>
        <p>Auto mapping can be rerun from the column mapper whenever a source has been loaded.</p>
        <div class="route-actions">
          <button class="secondary-btn" type="button" data-route="mapper">Open mapper</button>
          <button class="secondary-btn" type="button" data-route="reports">Open reports</button>
        </div>
      </article>
    </section>
  `;
  bindThemeControls(contentRoot);
  bindRouteActions(contentRoot);
}

function renderHelpPage() {
  setPageTitle("Help");
  setActiveNav("Help");
  currentStep = "help";
  contentRoot.innerHTML = `
    <section class="route-page">
      <article class="route-hero compact">
        <div>
          <p class="eyebrow">Help</p>
          <h2>Workflow guide</h2>
          <p>Each screen is ready: upload, map, dashboard, reports, and settings all route from the sidebar.</p>
        </div>
        <div class="route-actions">
          <button class="primary-btn" type="button" data-route="upload">Start upload</button>
          <button class="secondary-btn" type="button" data-route="settings">Customize colors</button>
        </div>
      </article>
      <div class="interface-grid">
        ${interfaceCard("1. Choose Source", "Upload CSV, TSV, Excel, JSON, or connect a supported public source.")}
        ${interfaceCard("2. Auto Map", "Use auto mapping, then adjust any field manually before generating the dashboard.")}
        ${interfaceCard("3. Customize", "Add custom KPI cards from numeric fields and apply color codes for the dashboard.")}
      </div>
    </section>
  `;
  bindRouteActions(contentRoot);
}

function goToStep(step) {
  if (step !== "dashboard" && !document.querySelector(`[data-step-panel='${step}']`)) {
    restoreWizard();
  }
  document.querySelectorAll("[data-step-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.stepPanel !== step;
  });

  currentStep = step;
  if (step === "source") {
    setPageTitle("Upload");
    setActiveNav("Upload");
  }
  if (step === "mapper") {
    setPageTitle("Map Columns");
    setActiveNav("Upload");
  }
  if (step === "dashboard") {
    setPageTitle("Dashboard");
    setActiveNav("Dashboard");
    renderDashboard();
  }
}

function bindDateFilter() {
  const button = document.getElementById("date-filter-btn");
  const menu = document.getElementById("date-filter-menu");
  const label = document.getElementById("date-filter-label");
  if (!button || !menu || !label) return;
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });
  menu.querySelectorAll("[data-filter]").forEach((item) => {
    item.addEventListener("click", () => {
      window.__dataLens.dateFilter = item.dataset.filter;
      label.textContent = FILTER_LABELS[item.dataset.filter] || FILTER_LABELS.all;
      menu.hidden = true;
      if (currentStep === "reports") {
        renderReportsPage();
      } else {
        renderDashboard();
      }
    });
  });
}

function bindExportMenu() {
  const button = document.getElementById("export-btn");
  const menu = document.getElementById("export-menu");
  if (!button || !menu) return;
  button.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
  });
  menu.querySelectorAll("[data-export]").forEach((item) => {
    item.addEventListener("click", async () => {
      menu.hidden = true;
      await runExportAction(item.dataset.export);
    });
  });
}

async function runExportAction(action) {
  try {
    if (action === "png") await exportDashboardAsPng();
    if (action === "kpis") exportKpisAsCsv();
    if (action === "data") exportFullDataAsCsv();
  } catch (error) {
    alert(error.message);
  }
}

function bindResetModal() {
  const button = document.getElementById("change-data-btn");
  const logout = document.getElementById("logout-btn");
  const modal = document.getElementById("confirm-modal");
  if (!button || !modal) return;
  document.getElementById("cancel-reset").addEventListener("click", () => {
    modal.hidden = true;
  });
  document.getElementById("confirm-reset").addEventListener("click", () => {
    modal.hidden = true;
    resetApp();
  });
  button.addEventListener("click", () => {
    if (window.__dataLens.rows) {
      modal.hidden = false;
    } else {
      goToStep("source");
    }
  });
  logout?.addEventListener("click", () => {
    if (window.__dataLens.rows) {
      modal.hidden = false;
    } else {
      goToStep("source");
    }
  });
}

function bindUtilityMenus() {
  bindDropdownButton("notifications-btn", "notifications-menu");
  bindDropdownButton("profile-btn", "profile-menu");
  document.querySelectorAll("[data-profile-route]").forEach((item) => {
    item.addEventListener("click", () => {
      navigateTo(item.dataset.profileRoute);
      closeUtilityMenus();
    });
  });
}

function bindDropdownButton(buttonId, menuId) {
  const button = document.getElementById(buttonId);
  const menu = document.getElementById(menuId);
  if (!button || !menu) return;
  button.addEventListener("click", () => {
    const wasHidden = menu.hidden;
    closeUtilityMenus();
    menu.hidden = !wasHidden;
  });
}

function closeUtilityMenus() {
  document.querySelectorAll("[data-utility-menu]").forEach((menu) => {
    menu.hidden = true;
  });
}

function bindGlobalSearch() {
  const input = document.getElementById("global-search");
  if (!input) return;
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const query = input.value.trim().toLowerCase();
    if (!query) return;
    if (query.includes("report")) navigateTo("reports");
    else if (query.includes("setting") || query.includes("color") || query.includes("custom")) navigateTo("settings");
    else if (query.includes("help")) navigateTo("help");
    else if (query.includes("map")) navigateTo("mapper");
    else if (query.includes("upload") || query.includes("source")) navigateTo("upload");
    else navigateTo("dashboard");
  });
}

function bindRouteActions(root) {
  root.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.route));
  });
  root.querySelectorAll("[data-export-action]").forEach((button) => {
    button.addEventListener("click", () => runExportAction(button.dataset.exportAction));
  });
}

function getCurrentReportData() {
  const state = window.__dataLens;
  if (!state.rows || !state.mapping) {
    return null;
  }
  const data = aggregateDashboard(state.rows, state.mapping, state.dateFilter || "all", state.period || "month");
  state.dashboardData = data;
  return data;
}

function interfaceCard(title, body) {
  return `
    <article class="interface-card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
    </article>
  `;
}

function reportMetric(label, value) {
  return `
    <article class="report-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function reportList(title, rows) {
  const items = rows?.length
    ? rows.slice(0, 5).map((row) => `<li><span>${escapeHtml(row.label)}</span><strong>${formatCurrency(row.value)}</strong></li>`).join("")
    : "<li><span>No mapped data yet</span><strong>-</strong></li>";
  return `
    <article class="settings-panel">
      <h3>${escapeHtml(title)}</h3>
      <ol class="report-list">${items}</ol>
    </article>
  `;
}

function themePanelMarkup(scope) {
  const theme = { ...DEFAULT_THEME, ...(window.__dataLens.theme || {}) };
  return `
    <article class="settings-panel color-code-panel" data-theme-scope="${scope}">
      <div class="settings-panel-header">
        <div>
          <h3>Color codes</h3>
          <p>Use exact color values for chart and KPI customization.</p>
        </div>
        <div class="palette-row">
          <button class="palette-swatch" type="button" data-palette="green" style="--swatch:${THEME_PRESETS.green.accent}" aria-label="Green palette"></button>
          <button class="palette-swatch" type="button" data-palette="blue" style="--swatch:${THEME_PRESETS.blue.accent}" aria-label="Blue palette"></button>
          <button class="palette-swatch" type="button" data-palette="rose" style="--swatch:${THEME_PRESETS.rose.accent}" aria-label="Rose palette"></button>
        </div>
      </div>
      <div class="color-code-grid">
        ${colorInput("accent", "Accent", theme.accent)}
        ${colorInput("barPrimary", "Bar primary", theme.barPrimary)}
        ${colorInput("barSecondary", "Bar secondary", theme.barSecondary)}
        ${colorInput("trend", "Trend", theme.trend)}
      </div>
    </article>
  `;
}

function colorInput(name, label, value) {
  return `
    <label class="color-code-field">
      <span>${escapeHtml(label)}</span>
      <input type="color" value="${escapeAttribute(value)}" data-theme-color="${name}">
      <code>${escapeHtml(value)}</code>
    </label>
  `;
}

function bindThemeControls(root) {
  root.querySelectorAll("[data-theme-color]").forEach((input) => {
    input.addEventListener("input", () => {
      const nextTheme = { ...DEFAULT_THEME, ...(window.__dataLens.theme || {}) };
      nextTheme[input.dataset.themeColor] = input.value;
      window.__dataLens.theme = nextTheme;
      applyDashboardTheme(nextTheme);
      input.closest(".color-code-field")?.querySelector("code")?.replaceChildren(input.value);
      renderDashboard();
    });
  });

  root.querySelectorAll("[data-palette]").forEach((button) => {
    button.addEventListener("click", () => {
      window.__dataLens.theme = { ...THEME_PRESETS[button.dataset.palette] };
      applyDashboardTheme(window.__dataLens.theme);
      syncThemeControls(root);
      renderDashboard();
    });
  });
}

function syncThemeControls(root = document) {
  const theme = { ...DEFAULT_THEME, ...(window.__dataLens.theme || {}) };
  root.querySelectorAll("[data-theme-color]").forEach((input) => {
    const value = theme[input.dataset.themeColor] || DEFAULT_THEME[input.dataset.themeColor];
    input.value = value;
    input.closest(".color-code-field")?.querySelector("code")?.replaceChildren(value);
  });
}

function resetApp() {
  const theme = window.__dataLens.theme;
  destroyCharts();
  window.__dataLens = {
    rows: null,
    columns: null,
    mapping: null,
    charts: {},
    dateFilter: "all",
    dashboardData: null,
    period: "month",
    customKpis: [],
    theme,
  };
  applyDashboardTheme(theme);
  document.getElementById("date-filter-label").textContent = FILTER_LABELS.all;
  contentRoot.innerHTML = initialContent;
  bindUploadFlow();
  selectSource("file");
  goToStep("source");
}

function showProgress(percent = 60) {
  const progress = document.getElementById("upload-progress");
  const bar = progress?.querySelector("span");
  if (!progress || !bar) return;
  progress.hidden = false;
  requestAnimationFrame(() => {
    bar.style.width = `${percent}%`;
  });
}

function showRowCountBadge(sourceName, rowCount, columnCount) {
  const result = document.getElementById("file-result");
  if (!result) return;
  result.hidden = false;
  result.innerHTML = "";
  const badge = document.createElement("span");
  badge.className = "row-badge";
  badge.textContent = `${sourceName}: ${rowCount.toLocaleString()} rows · ${columnCount.toLocaleString()} columns`;
  result.appendChild(badge);
}

function showFileError(message) {
  const result = document.getElementById("file-result");
  if (!result) return;
  result.hidden = false;
  result.textContent = message;
  result.style.color = "var(--danger)";
}

function setMessage(element, text, state) {
  element.textContent = text;
  element.className = `form-message is-${state}`;
}

function setPageTitle(title) {
  document.getElementById("page-title").textContent = title;
}

function setActiveNav(label) {
  document.querySelectorAll("[data-nav]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.nav === label);
  });
}

function roleLabel(role) {
  if (role === "ignore") return "Not used";
  if (role === "metric") return "Custom metric";
  return role.charAt(0).toUpperCase() + role.slice(1);
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
