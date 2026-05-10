export function parseCSV(file, delimiter = "") {
  return new Promise((resolve, reject) => {
    if (!window.Papa) {
      reject(new Error("PapaParse is not loaded."));
      return;
    }

    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      worker: true,
      delimiter,
      complete: ({ data, meta, errors }) => {
        if (errors.length) {
          console.warn("CSV parse warnings:", errors);
        }
        resolve({ rows: data, columns: meta.fields || inferColumns(data) });
      },
      error: reject,
    });
  });
}

export function parseCSVText(text, delimiter = "") {
  if (!window.Papa) {
    throw new Error("PapaParse is not loaded.");
  }

  const result = window.Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimiter,
  });

  if (result.errors.length) {
    console.warn("CSV parse warnings:", result.errors);
  }

  return {
    rows: result.data,
    columns: result.meta.fields || inferColumns(result.data),
  };
}

function inferColumns(rows) {
  return rows.length > 0 ? Object.keys(rows[0]) : [];
}
