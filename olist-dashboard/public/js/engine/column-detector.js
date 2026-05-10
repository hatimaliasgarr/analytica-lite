import { parseDate, toNumber } from "./formatter.js";

const ROLE_OPTIONS = [
  "ignore",
  "date",
  "revenue",
  "quantity",
  "status",
  "category",
  "region",
  "rating",
  "metric",
  "id",
];

export function getRoleOptions() {
  return ROLE_OPTIONS;
}

export function detectColumns(columns, sampleRows) {
  const rows = Array.isArray(sampleRows) ? sampleRows : [];
  const result = {};
  columns.forEach((column) => {
    const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
    result[column] = detectColumnRole(column, values);
  });
  return result;
}

export function detectColumnRole(column, values) {
  const name = String(column).toLowerCase();
  const uniqueCount = new Set(values.map((value) => String(value).toLowerCase())).size;
  const numericValues = values.map(toNumber);
  const numericRatio = values.length
    ? numericValues.filter((value) => Number.isFinite(value) && value !== 0).length / values.length
    : 0;
  const integerRatio = numericValues.length
    ? numericValues.filter((value) => Number.isInteger(value)).length / numericValues.length
    : 0;
  const dateRatio = values.length
    ? values.filter((value) => parseDate(value)).length / values.length
    : 0;

  if (/(^id$|_id$|\bid\b)/.test(name)) {
    return "id";
  }

  if (
    /(date|time|timestamp|created|purchased|_at\b|\bat\b|day|month|year)/.test(name)
    || dateRatio > 0.8
  ) {
    return "date";
  }

  if (
    /(price|revenue|value|amount|total|sales|gmv|income|payment|subtotal|net|gross|freight)/.test(name)
    && numericRatio > 0.6
  ) {
    return "revenue";
  }

  if (
    /(qty|quantity|count|units|volume|items|number)/.test(name)
    && numericRatio > 0.6
    && integerRatio > 0.7
  ) {
    return "quantity";
  }

  if (/(state|city|country|region|location|geo|zip|postal)/.test(name) && uniqueCount < 500) {
    return "region";
  }

  if (/(status|stage|phase)/.test(name) && uniqueCount < 20) {
    return "status";
  }

  if (/(category|cat|type|class|segment|product_name|genre)/.test(name) && uniqueCount < 200) {
    return "category";
  }

  if (/(score|rating|review|stars|grade)/.test(name) && isRatingRange(numericValues)) {
    return "rating";
  }

  if (numericRatio > 0.85 && uniqueCount > 5) {
    return "metric";
  }

  return "ignore";
}

function isRatingRange(values) {
  const realValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!realValues.length) {
    return false;
  }
  return realValues.every((value) => value >= 1 && value <= 10);
}
