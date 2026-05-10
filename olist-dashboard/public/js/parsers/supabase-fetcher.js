export async function fetchFromSupabase({
  url,
  anonKey,
  table,
  limit = 10000,
}) {
  if (!url || !anonKey || !table) {
    throw new Error("URL, Anon Key, and Table Name are required.");
  }

  const cleanUrl = url.replace(/\/$/, "");
  const safeLimit = Number(limit) > 0 ? Number(limit) : 10000;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  const testRes = await fetch(`${cleanUrl}/rest/v1/${encodeURIComponent(table)}?limit=1`, {
    headers,
  });

  if (!testRes.ok) {
    const error = await testRes.json().catch(() => ({}));
    throw new Error(error.message || `Connection failed: HTTP ${testRes.status}`);
  }

  let allRows = [];
  let from = 0;
  const pageSize = 1000;

  while (allRows.length < safeLimit) {
    const pageLimit = Math.min(pageSize, safeLimit - allRows.length);
    const response = await fetch(
      `${cleanUrl}/rest/v1/${encodeURIComponent(table)}?limit=${pageLimit}&offset=${from}`,
      {
        headers: {
          ...headers,
          Prefer: "count=none",
        },
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Fetch failed: HTTP ${response.status}`);
    }

    const page = await response.json();
    if (!Array.isArray(page) || page.length === 0) {
      break;
    }

    allRows = allRows.concat(page);
    if (page.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  const columns = allRows.length > 0 ? Object.keys(allRows[0]) : [];
  return { rows: allRows, columns };
}
