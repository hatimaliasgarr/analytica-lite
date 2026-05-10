export function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value)
    .replace(/[^\d,.-]/g, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (value > 10000000000) {
      const timestampDate = new Date(value);
      return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
    }
    return null;
  }

  const trimmed = String(value).trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed) && trimmed.length < 8) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCurrency(value, compact = true) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number(value || 0));
}

export function formatNumber(value, compact = true) {
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function formatDateLabel(date, period = "month") {
  if (period === "year") {
    return new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(date);
  }
  if (period === "quarter") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `Q${quarter} ${date.getFullYear()}`;
  }
  if (period === "day") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatMonthShort(label) {
  const date = new Date(`${label} 1`);
  if (Number.isNaN(date.getTime())) {
    return String(label).split(" ")[0] || label;
  }
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}
