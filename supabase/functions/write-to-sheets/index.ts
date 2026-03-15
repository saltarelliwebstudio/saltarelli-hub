const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Transaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense" | "transfer";
}

interface WriteRequest {
  transactions: Transaction[];
  account: string;
  month: string; // e.g. "Mar 2026"
}

// Build a JWT from service account credentials using Web Crypto API
async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function ensureSheetTab(
  accessToken: string,
  sheetId: string,
  tabName: string
): Promise<void> {
  // Get existing sheets
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!metaRes.ok) {
    throw new Error(`Failed to get sheet metadata: ${await metaRes.text()}`);
  }

  const meta = await metaRes.json();
  const existingTabs = meta.sheets?.map((s: any) => s.properties.title) || [];

  if (existingTabs.includes(tabName)) return;

  // Create the tab
  const addRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title: tabName },
            },
          },
        ],
      }),
    }
  );

  if (!addRes.ok) {
    throw new Error(`Failed to create tab "${tabName}": ${await addRes.text()}`);
  }

  // Add header row
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A1:F1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [["Date", "Description", "Amount", "Category", "Type", "Account"]],
      }),
    }
  );
}

async function appendRows(
  accessToken: string,
  sheetId: string,
  tabName: string,
  rows: string[][]
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName)}!A:F:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: rows }),
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to append to "${tabName}": ${await res.text()}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transactions, account, month }: WriteRequest = await req.json();

    if (!transactions?.length || !account || !month) {
      return new Response(
        JSON.stringify({ error: "transactions, account, and month are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

    if (!sheetId || !serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "Google Sheets credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    // Build rows
    const rows = transactions.map((t) => [
      t.date,
      t.description,
      t.type === "expense" ? `-${t.amount}` : String(t.amount),
      t.category,
      t.type,
      account,
    ]);

    // Ensure month tab exists and Master Log tab exists
    await ensureSheetTab(accessToken, sheetId, month);
    await ensureSheetTab(accessToken, sheetId, "Master Log");

    // Append to both tabs
    await appendRows(accessToken, sheetId, month, rows);
    await appendRows(accessToken, sheetId, "Master Log", rows);

    return new Response(
      JSON.stringify({
        success: true,
        rowsWritten: rows.length,
        tabs: [month, "Master Log"],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Write to sheets error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
