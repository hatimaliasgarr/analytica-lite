import { formatCurrency, formatMonthShort } from "../engine/formatter.js";

export function renderRevenueBarChart(canvas, series) {
  const values = series.map((item) => item.value);
  const average = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
  const recentStart = Math.max(0, series.length - 4);

  return new window.Chart(canvas, {
    type: "bar",
    data: {
      labels: series.map((item) => formatMonthShort(item.label)),
      datasets: [
        {
          type: "bar",
          label: "Revenue",
          data: values,
          backgroundColor: series.map((_item, index) => (
            index >= recentStart
              ? getCssVar("--chart-bar-primary")
              : getCssVar("--chart-bar-secondary")
          )),
          borderRadius: 8,
          barPercentage: 0.64,
          categoryPercentage: 0.72,
        },
        {
          type: "line",
          label: "Trend",
          data: values.map((_value, index) => average + ((index - values.length / 2) * (average * 0.02))),
          borderColor: getCssVar("--chart-line-trend"),
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y, false)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          ticks: {
            callback: (value) => formatCurrency(value),
          },
        },
      },
    },
  });
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
