import { verifyAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface ReadRequest {
  months?: number;
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
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions(req);
  }

  const corsHeaders = getCorsHeaders(req);

  const authCheck = await verifyAdmin(req);
  if (authCheck.error) {
    return new Response(JSON.stringify({ error: authCheck.error }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: ReadRequest = req.method === "POST" ? await req.json() : {};
    const monthsBack = body.months ?? 12;

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

    // Read from Master Log
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent("Master Log")}!A:I`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const errText = await res.text();
      // If Master Log doesn't exist yet, return empty data
      if (errText.includes("Unable to parse range")) {
        return new Response(
          JSON.stringify({ rows: [], monthlyTotals: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Failed to read sheet: ${errText}`);
    }

    const data = await res.json();
    const allRows = data.values || [];

    // Skip header row
    const dataRows = allRows.slice(1);

    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);

    const filteredRows = dataRows.filter((row: string[]) => {
      if (!row[0]) return false;
      const rowDate = new Date(row[0]);
      return rowDate >= cutoffDate;
    });

    // Compute monthly totals
    const monthlyMap = new Map<string, { income: number; expenses: number; transfers: number }>();

    for (const row of filteredRows) {
      const [date, , amountStr, , type] = row;
      if (!date || !amountStr) continue;

      const d = new Date(date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const amount = Math.abs(parseFloat(amountStr) || 0);

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { income: 0, expenses: 0, transfers: 0 });
      }

      const totals = monthlyMap.get(monthKey)!;
      if (type === "income") totals.income += amount;
      else if (type === "expense") totals.expenses += amount;
      else if (type === "transfer") totals.transfers += amount;
    }

    const monthlyTotals = Array.from(monthlyMap.entries())
      .map(([month, totals]) => ({ month, ...totals }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Also compute category totals
    const categoryMap = new Map<string, number>();
    for (const row of filteredRows) {
      const [, , amountStr, category, type] = row;
      if (!category || type === "transfer") continue;
      const amount = Math.abs(parseFloat(amountStr) || 0);
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    }

    const categoryTotals = Array.from(categoryMap.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);

    return new Response(
      JSON.stringify({
        rows: filteredRows.map((row: string[]) => ({
          date: row[0] || "",
          description: row[1] || "",
          amount: parseFloat(row[2] || "0"),
          category: row[3] || "",
          type: row[4] || "",
          account: row[5] || "",
          paymentMethod: row[6] || "",
          taxDeductible: row[7] === "Yes",
          notes: row[8] || "",
        })),
        monthlyTotals,
        categoryTotals,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Read sheets data error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
