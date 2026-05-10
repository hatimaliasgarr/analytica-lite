import {
  formatDateLabel,
  parseDate,
  toNumber,
} from "./formatter.js";

const NEGATIVE_STATUS = ["cancel", "refund", "return", "failed", "rejected", "chargeback"];
const POSITIVE_STATUS = ["delivered", "complete", "completed", "paid", "success", "shipped", "fulfilled"];

export function aggregateDashboard(rows, mapping, filter = "all", period = "month") {
  const filteredRows = applyDateFilter(rows, mapping, filter);
  const revenueSeries = revenueByPeriod(filteredRows, mapping, period);
  const categoryRows = topCategories(filteredRows, mapping, 5);
  const regionRows = topRegions(filteredRows, mapping, 10);
  const statusRows = ordersByStatus(filteredRows, mapping);
  const ratingRows = ratingDistribution(filteredRows, mapping);
  const sparkline = sparklineRevenue(filteredRows, mapping);

  return {
    rows: filteredRows,
    kpis: computeKPIs(filteredRows, mapping, period),
    revenueByPeriod: revenueSeries,
    topCategories: categoryRows,
    topRegions: regionRows,
    ordersByStatus: statusRows,
    revenueByCategory: revenueByCategory(filteredRows, mapping),
    ratingDistribution: ratingRows,
    visitors: visitorsOverTime(filteredRows, mapping),
    sparklineRevenue: sparkline,
  };
}

export function computeKPIs(rows, mapping, period = "month") {
  const totalRevenue = sumBy(rows, mapping.revenue);
  const totalOrders = mapping.quantity ? sumBy(rows, mapping.quantity) : rows.length;
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
  const avgRating = mapping.rating ? averageBy(rows, mapping.rating) : null;
  const categoryTotals = mapping.category ? groupRevenue(rows, mapping.category, mapping.revenue) : [];
  const regionTotals = mapping.region ? groupRevenue(rows, mapping.region, mapping.revenue) : [];
  const statusRows = ordersByStatus(rows, mapping);
  const positive = statusRows.find((item) => hasKeyword(item.label, POSITIVE_STATUS));
  const negativeCount = rows.filter((row) => hasKeyword(row[mapping.status], NEGATIVE_STATUS)).length;
  const revenueSeries = revenueByPeriod(rows, mapping, period);
  const orderSeries = ordersByPeriod(rows, mapping, period);

  return {
    totalRevenue,
    totalOrders,
    avgOrderValue,
    avgRating,
    topRegion: regionTotals[0]?.label || null,
    topCategory: categoryTotals[0]?.label || null,
    deliveredCount: positive?.count || 0,
    returnRate: rows.length ? (negativeCount / rows.length) * 100 : 0,
    revenueGrowth: growthFromSeries(revenueSeries.map((item) => item.value)),
    ordersGrowth: growthFromSeries(orderSeries.map((item) => item.value)),
  };
}

export function revenueByPeriod(rows, mapping, period = "month") {
  return groupByPeriod(rows, mapping, period, (bucket, row) => {
    bucket.value += toNumber(row[mapping.revenue]);
  }).map(({ label, value }) => ({ label, value }));
}

export function topCategories(rows, mapping, n = 5) {
  if (!mapping.category) {
    return [];
  }
  const total = sumBy(rows, mapping.revenue);
  return groupRevenue(rows, mapping.category, mapping.revenue)
    .slice(0, n)
    .map((item) => ({
      ...item,
      percent: total ? (item.value / total) * 100 : 0,
    }));
}

export function topRegions(rows, mapping, n = 10) {
  if (!mapping.region) {
    return [];
  }
  const total = sumBy(rows, mapping.revenue);
  return groupRevenue(rows, mapping.region, mapping.revenue)
    .slice(0, n)
    .map((item) => ({
      ...item,
      percent: total ? (item.value / total) * 100 : 0,
    }));
}

export function ordersByStatus(rows, mapping) {
  if (!mapping.status) {
    return [];
  }

  const counts = new Map();
  rows.forEach((row) => {
    const label = cleanLabel(row[mapping.status]);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, count]) => ({
      label,
      count,
      percent: rows.length ? (count / rows.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function revenueByCategory(rows, mapping) {
  if (!mapping.category) {
    return [];
  }
  return groupRevenue(rows, mapping.category, mapping.revenue);
}

export function ratingDistribution(rows, mapping) {
  if (!mapping.rating) {
    return [];
  }

  const counts = new Map([1, 2, 3, 4, 5].map((star) => [star, 0]));
  rows.forEach((row) => {
    const rating = Math.max(1, Math.min(5, Math.round(toNumber(row[mapping.rating]))));
    counts.set(rating, (counts.get(rating) || 0) + 1);
  });

  return [...counts.entries()].map(([star, count]) => ({ star, count }));
}

export function visitorsOverTime(rows, mapping) {
  const unique = mapping.id
    ? new Set(rows.map((row) => row[mapping.id]).filter(Boolean)).size
    : rows.length;
  const dates = rows.map((row) => parseDate(row[mapping.date])).filter(Boolean);
  const days = new Set(dates.map((date) => date.toISOString().slice(0, 10))).size || 1;

  return {
    total: rows.length,
    unique,
    avgPerDay: rows.length / days,
  };
}

export function sparklineRevenue(rows, mapping) {
  return revenueByPeriod(rows, mapping, "month")
    .slice(-12)
    .map((item) => item.value);
}

export function applyDateFilter(rows, mapping, filter) {
  if (!mapping.date || filter === "all") {
    return rows.slice();
  }

  const datedRows = rows
    .map((row) => ({ row, date: parseDate(row[mapping.date]) }))
    .filter((item) => item.date);
  if (!datedRows.length) {
    return [];
  }

  const maxTime = Math.max(...datedRows.map((item) => item.date.getTime()));
  const maxDate = new Date(maxTime);
  const start = new Date(maxDate);

  if (filter === "7d") start.setDate(start.getDate() - 7);
  if (filter === "30d") start.setDate(start.getDate() - 30);
  if (filter === "3m") start.setMonth(start.getMonth() - 3);
  if (filter === "6m") start.setMonth(start.getMonth() - 6);
  if (filter === "1y") start.setFullYear(start.getFullYear() - 1);

  return datedRows
    .filter((item) => item.date >= start && item.date <= maxDate)
    .map((item) => item.row);
}

function groupByPeriod(rows, mapping, period, reducer) {
  const buckets = new Map();
  rows.forEach((row) => {
    const date = parseDate(row[mapping.date]);
    if (!date) {
      return;
    }

    const key = getPeriodKey(date, period);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        date: getPeriodDate(date, period),
        label: formatDateLabel(date, period),
        value: 0,
        orders: 0,
      });
    }
    const bucket = buckets.get(key);
    bucket.orders += mapping.quantity ? toNumber(row[mapping.quantity]) : 1;
    reducer(bucket, row);
  });

  return [...buckets.values()].sort((a, b) => a.date - b.date);
}

function ordersByPeriod(rows, mapping, period) {
  return groupByPeriod(rows, mapping, period, () => {})
    .map((item) => ({ label: item.label, value: item.orders }));
}

function getPeriodKey(date, period) {
  if (period === "year") return `${date.getFullYear()}`;
  if (period === "quarter") return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (period === "day") return date.toISOString().slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getPeriodDate(date, period) {
  if (period === "year") return new Date(date.getFullYear(), 0, 1);
  if (period === "quarter") return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
  if (period === "day") return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function groupRevenue(rows, groupColumn, revenueColumn) {
  const totals = new Map();
  rows.forEach((row) => {
    const label = cleanLabel(row[groupColumn]);
    totals.set(label, (totals.get(label) || 0) + toNumber(row[revenueColumn]));
  });

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function sumBy(rows, column) {
  if (!column) {
    return 0;
  }
  return rows.reduce((sum, row) => sum + toNumber(row[column]), 0);
}

function averageBy(rows, column) {
  const values = rows
    .map((row) => toNumber(row[column]))
    .filter((value) => Number.isFinite(value) && value > 0);
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function growthFromSeries(values) {
  const realValues = values.filter((value) => Number.isFinite(value));
  if (realValues.length < 2) {
    return 0;
  }
  const previous = realValues[realValues.length - 2];
  const current = realValues[realValues.length - 1];
  return previous ? ((current - previous) / Math.abs(previous)) * 100 : 0;
}

function cleanLabel(value) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }
  return String(value).trim();
}

function hasKeyword(value, keywords) {
  const text = String(value || "").toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}
