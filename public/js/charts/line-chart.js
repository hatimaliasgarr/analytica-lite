import { formatCurrency, formatNumber } from "../engine/formatter.js";

export function renderMiniLineChart(canvas, series) {
  return new window.Chart(canvas, {
    type: "line",
    data: {
      labels: series.map((item) => item.label),
      datasets: [
        {
          data: series.map((item) => item.value),
          borderColor: getCssVar("--accent"),
          backgroundColor: getCssVar("--accent-light"),
          borderWidth: 2,
          fill: true,
          pointRadius: 0,
          tension: 0.4,
        },
      ],
    },
    options: axislessOptions(),
  });
}

export function renderTrendLineChart(canvas, revenueSeries, orderSeries) {
  return new window.Chart(canvas, {
    type: "line",
    data: {
      labels: revenueSeries.map((item) => item.label),
      datasets: [
        {
          label: "Revenue",
          data: revenueSeries.map((item) => item.value),
          borderColor: getCssVar("--accent"),
          backgroundColor: getCssVar("--accent-light"),
          borderWidth: 2,
          yAxisID: "y",
          pointRadius: 0,
          tension: 0.4,
        },
        {
          label: "Orders",
          data: orderSeries,
          borderColor: getCssVar("--chart-line-trend"),
          borderWidth: 2,
          yAxisID: "y1",
          pointRadius: 0,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => (
              context.dataset.yAxisID === "y"
                ? `Revenue: ${formatCurrency(context.parsed.y, false)}`
                : `Orders: ${formatNumber(context.parsed.y, false)}`
            ),
          },
        },
      },
      scales: {
        x: { display: false },
        y: {
          position: "left",
          ticks: { callback: (value) => formatCurrency(value) },
        },
        y1: {
          position: "right",
          grid: { display: false },
          ticks: { callback: (value) => formatNumber(value) },
        },
      },
    },
  });
}

function axislessOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      line: { borderCapStyle: "round" },
    },
  };
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
