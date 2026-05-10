const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart, _args, options) {
    const { ctx, chartArea } = chart;
    if (!chartArea || !options?.lines?.length) {
      return;
    }

    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = getCssVar("--text-primary");
    ctx.font = "700 14px Poppins, sans-serif";
    ctx.fillText(options.lines[0], centerX, centerY - 5);

    ctx.fillStyle = getCssVar("--text-secondary");
    ctx.font = "500 10px Inter, sans-serif";
    ctx.fillText(options.lines[1] || "", centerX, centerY + 12);
    ctx.restore();
  },
};

export function renderDonutChart(canvas, item, colorVar) {
  const percent = Math.max(0, Math.min(100, item.percent || 0));
  return new window.Chart(canvas, {
    type: "doughnut",
    data: {
      labels: [item.label, "Other"],
      datasets: [
        {
          data: [percent, Math.max(0, 100 - percent)],
          backgroundColor: [getCssVar(colorVar), getCssVar("--chart-donut-track")],
          borderWidth: 0,
          hoverOffset: 0,
        },
      ],
    },
    plugins: [centerTextPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "76%",
      plugins: {
        tooltip: { enabled: false },
        centerText: {
          lines: [`${Math.round(percent)}%`, truncateLabel(item.label)],
        },
      },
    },
  });
}

function truncateLabel(label) {
  const text = String(label || "Category");
  return text.length > 12 ? `${text.slice(0, 10)}...` : text;
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
