export function renderSparkline(svg, values) {
  svg.innerHTML = "";
  const safeValues = values.length ? values : [0, 0, 0];
  const width = 60;
  const height = 32;
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1
      ? width / 2
      : (index / (safeValues.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points.join(" "));
  svg.appendChild(polyline);
}
