export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      reject(new Error("SheetJS is not loaded."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = window.XLSX.read(event.target.result, {
          type: "array",
          cellDates: true,
        });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(worksheet, { defval: null });
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        resolve({ rows, columns });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
