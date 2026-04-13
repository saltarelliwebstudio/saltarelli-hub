import { verifyAdmin } from "../_shared/auth.ts";
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

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
  paymentMethod: "debit" | "credit" | "cash" | "e-transfer" | "other";
  taxDeductible: boolean;
  notes: string;
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

Context: The user (Adam) runs a web development/AI automation agency called Saltarelli Web Studio. Many business subscriptions are charged to his personal debit card. The following vendors are KNOWN BUSINESS expenses regardless of which account they appear on:
- Anthropic, Claude.ai — AI tools for client work
- Vercel, Supabase, Modal.com — hosting/infrastructure for client projects
- Retell AI (retellai.co), OpenPhone, QUO (OpenPhone) — business phone/voice AI
- Instantly — email outreach/sales tool
- Buffer — social media scheduling for clients
- Manus AI — AI agent platform
- Lovable — AI app builder
- Castmagic, Opus Clip, Descript — content creation tools for business
- Wispr — AI dictation tool
- X Corp (Twitter) paid features — business social media
- Skool (p.skool.com) — online community platform
- Google services (Workspace, domains) — business tools

Known clients who pay via e-Transfer: Jeff Bognar (Fort Bell Marine), Zachary Melnyk (Melnyk Concrete), Jason Franks, Jakub Szczepanski, German Sanchez (Aborigen Handcrafts).

Rules:
- Internal transfers between own accounts should be categorized as "Internal Transfer" with type "transfer"
- If a transaction is ambiguous or you're unsure about the category, set confidence to "low"
- Positive amounts or deposits are type "income", negative amounts or withdrawals/purchases are type "expense"
- Internal transfers are type "transfer"
- Parse dates in whatever format they appear and normalize to YYYY-MM-DD
- Extract the amount as a number (positive value, the type field indicates direction)
- Clean up the description (remove extra spaces, transaction codes, etc.) but keep it recognizable
- Determine payment method from context: debit card purchases → "debit", credit card → "credit", cash → "cash", e-transfers → "e-transfer", otherwise → "other"
- For known business vendors (listed above): ALWAYS set taxDeductible: true and add note "Business expense" even on the personal account. Use category "Software/Apps" for software, "Education" for courses, "Office Supplies" for physical items.
- For known client e-Transfers: categorize as type "income" and add note with client name/business.
- For business account: expenses like Software/Apps, Education, Office Supplies are taxDeductible: true. Income is taxDeductible: false. Internal transfers are taxDeductible: false.
- For personal account: generally taxDeductible: false unless it's a known business vendor or clearly business-related
- For savings account: taxDeductible: false
- e-Transfers to German (Aborigen Handcrafts) are business payments, not gifts — taxDeductible: true
- Overdraft interest and bank monthly fees are bank charges, not Software/Apps or Office Supplies
- Add a brief note only if something is ambiguous or needs context for an accountant. Leave empty string if straightforward.

CRITICAL: Your response must be ONLY the JSON object below. No explanations, no preamble, no markdown fences, no commentary — just the raw JSON starting with {
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Clean description",
      "amount": 12.34,
      "category": "One of the available categories",
      "type": "income" | "expense" | "transfer",
      "paymentMethod": "debit" | "credit" | "cash" | "e-transfer" | "other",
      "taxDeductible": true | false,
      "notes": "",
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
        model: "claude-sonnet-4-6",
        max_tokens: 16384,
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
      console.error("Anthropic API error:", response.status, errorBody);
      return new Response(
        JSON.stringify({ error: "AI categorization failed", detail: errorBody, httpStatus: response.status }),
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

    // Parse the AI response — extract JSON from anywhere in the response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(content.trim());
    } catch {
      try {
        // Strip markdown fences
        const stripped = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(stripped);
      } catch {
        try {
          // Extract JSON object from surrounding text
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("No JSON found");
          }
        } catch {
          console.error("Failed to parse AI response:", content.slice(0, 500));
          return new Response(
            JSON.stringify({ error: "Failed to parse AI response", raw: content.slice(0, 200) }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
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
