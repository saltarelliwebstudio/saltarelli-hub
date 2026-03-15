const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AccountType = "personal" | "business" | "savings";

interface CategorizeRequest {
  rawText: string;
  account: AccountType;
}

interface CategorizedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense" | "transfer";
  confidence: "high" | "low";
  originalLine: string;
}

const personalCategories = [
  "Food",
  "Transportation",
  "Education",
  "Gifts",
  "Personal",
  "Haircut",
  "Clothing",
  "Entertainment",
  "Internal Transfer",
  "Refund",
];

const businessCategories = [
  "Software/Apps",
  "Education",
  "Office Supplies",
  "Income – E-Transfer",
  "Income – Stripe",
  "Income – Cash",
  "Internal Transfer",
  "Refund",
];

const savingsCategories = [
  "Internal Transfer",
  "Interest",
  "Deposit",
  "Withdrawal",
];

function getCategoriesForAccount(account: AccountType): string[] {
  switch (account) {
    case "personal":
      return personalCategories;
    case "business":
      return businessCategories;
    case "savings":
      return savingsCategories;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawText, account }: CategorizeRequest = await req.json();

    if (!rawText || !account) {
      return new Response(
        JSON.stringify({ error: "rawText and account are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const categories = getCategoriesForAccount(account);
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a financial transaction categorizer. Parse raw bank statement text and categorize each transaction.

Account type: ${account}
Available categories: ${categories.join(", ")}

Rules:
- Internal transfers between own accounts should be categorized as "Internal Transfer" with type "transfer"
- Software tools and subscriptions → "Software/Apps" (business account only)
- If a transaction is ambiguous or you're unsure about the category, set confidence to "low"
- Positive amounts or deposits are type "income", negative amounts or withdrawals/purchases are type "expense"
- Internal transfers are type "transfer"
- Parse dates in whatever format they appear and normalize to YYYY-MM-DD
- Extract the amount as a number (positive value, the type field indicates direction)
- Clean up the description (remove extra spaces, transaction codes, etc.) but keep it recognizable

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Clean description",
      "amount": 12.34,
      "category": "One of the available categories",
      "type": "income" | "expense" | "transfer",
      "confidence": "high" | "low",
      "originalLine": "The original text line"
    }
  ],
  "summary": {
    "totalIncome": 0,
    "totalExpenses": 0,
    "totalTransfers": 0,
    "transactionCount": 0
  }
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Here are the raw bank transactions to categorize:\n\n${rawText}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Anthropic API error:", errorBody);
      return new Response(
        JSON.stringify({ error: "AI categorization failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the AI response — strip any accidental markdown fences
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: content }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Categorize transactions error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
