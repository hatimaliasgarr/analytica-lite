export async function fetchFromFirebase({
  config,
  collection,
  whereClause,
  limit = 10000,
}) {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const {
    getFirestore,
    collection: col,
    getDocs,
    query,
    where,
    limit: fbLimit,
  } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  let parsedConfig;
  try {
    parsedConfig = JSON.parse(config);
  } catch {
    throw new Error("Invalid Firebase config JSON - paste the entire config object.");
  }

  if (!collection) {
    throw new Error("Collection name is required.");
  }

  const app = initializeApp(parsedConfig, `datalens-${Date.now()}`);
  const db = getFirestore(app);
  const constraints = [fbLimit(Number(limit) > 0 ? Number(limit) : 10000)];
  const parsedWhere = parseWhereClause(whereClause);
  if (parsedWhere) {
    constraints.unshift(where(parsedWhere.field, parsedWhere.operator, parsedWhere.value));
  }

  const snapshot = await getDocs(query(col(db, collection), ...constraints));
  const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, columns };
}

function parseWhereClause(whereClause) {
  if (!whereClause || !whereClause.trim()) {
    return null;
  }

  const match = whereClause.match(/^\s*([A-Za-z0-9_.-]+)\s*(==|!=|>=|<=|>|<)\s*['"]?(.+?)['"]?\s*$/);
  if (!match) {
    throw new Error("Where clause must look like: status == 'delivered'.");
  }

  const operatorMap = {
    "==": "==",
    "!=": "!=",
    ">=": ">=",
    "<=": "<=",
    ">": ">",
    "<": "<",
  };

  return {
    field: match[1],
    operator: operatorMap[match[2]],
    value: coerceValue(match[3]),
  };
}

function coerceValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? value : numberValue;
}
