export function parseJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const { rows, columns } = parseJSONString(event.target.result);
        resolve({ rows, columns });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function parseJSONString(text) {
  let data = JSON.parse(text);

  if (!Array.isArray(data)) {
    data = data.data
      || data.results
      || data.rows
      || data.records
      || Object.values(data).find((value) => Array.isArray(value));
  }

  if (!Array.isArray(data)) {
    throw new Error("Could not find an array in this JSON file.");
  }

  const rows = data.map((row) => flattenObject(row));
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns };
}

function flattenObject(value, prefix = "", output = {}) {
  if (value === null || typeof value !== "object" || value instanceof Date) {
    output[prefix || "value"] = value;
    return output;
  }

  if (Array.isArray(value)) {
    output[prefix || "value"] = value.join(", ");
    return output;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (
      nestedValue !== null
      && typeof nestedValue === "object"
      && !(nestedValue instanceof Date)
      && !Array.isArray(nestedValue)
    ) {
      flattenObject(nestedValue, nextKey, output);
      return;
    }
    output[nextKey] = Array.isArray(nestedValue) ? nestedValue.join(", ") : nestedValue;
  });

  return output;
}
