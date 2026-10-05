import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ExtractedProjectData } from "./types";

export const EXTRACTION_JSON_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    companyName: {
      type: SchemaType.STRING,
      description: "The issuing company shown on the document's letterhead/logo/footer. Must be exactly 'Whitespace Partners' or 'Whitespaceconnect' (matching whichever one appears in the document, case-sensitive). Empty string if neither can be identified.",
    },
    projectName: {
      type: SchemaType.STRING,
      description: "Project Name or Title (e.g. Street Burger at Petit Phuket)",
    },
    totalFee: {
      type: SchemaType.NUMBER,
      description: "Total Design Fee or Lump-sum amount as pure number (highlighted total, before VAT)",
    },
    timeFrames: {
      type: SchemaType.ARRAY,
      description: "ONLY the individual phases/stages from the time frame table. Do NOT include a summary/total row (e.g. 'Total Design Duration') — that goes in totalDesignDuration instead.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          phase: { type: SchemaType.STRING, description: "Exact phase or stage name" },
          description: { type: SchemaType.STRING, description: "Exact description from the document; empty string if none" },
          duration: { type: SchemaType.STRING, description: "Exact duration text, including units" },
        },
        required: ["phase", "description", "duration"],
      },
    },
    totalDesignDuration: {
      type: SchemaType.STRING,
      description: "The overall/total design duration summary text, if stated separately from the individual phases (e.g. '19 Weeks'). Empty string if none.",
    },
    paymentTerms: {
      type: SchemaType.ARRAY,
      description: "Every payment milestone/installment from the payment schedule",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          milestone: { type: SchemaType.STRING, description: "Exact milestone/installment description" },
          paymentPercentage: { type: SchemaType.NUMBER, description: "Exact percentage from the document as a number from 0 to 100" },
          amount: { type: SchemaType.NUMBER, description: "Exact payment amount from the document as a number" },
        },
        required: ["milestone", "paymentPercentage", "amount"],
      },
    },
  },
  required: ["projectName", "totalFee", "timeFrames", "paymentTerms"],
};

function buildTextContext(pdfText: string): string {
  const normalizedText = pdfText.replace(/\u0000/g, "").trim();
  // Kept short on purpose: the attached PDF (sent as inlineData below) is the
  // primary source of truth, this text is only a light aid for disambiguating
  // broken table columns. A large block here just adds tokens Gemini has to
  // process without adding accuracy, which was a main driver of slow (2min+)
  // extractions.
  const maxCharacters = 16000;

  if (normalizedText.length <= maxCharacters) {
    return normalizedText;
  }

  const half = Math.floor(maxCharacters / 2);
  return `${normalizedText.slice(0, half)}\n\n[...middle of extracted text omitted; use the attached PDF... ]\n\n${normalizedText.slice(-half)}`;
}

// Payment schedules in proposals often list amounts *including* VAT (e.g.
// 107,000 on a 200,000 fee at 50%), while totalFee is before VAT. Total Fee
// is the baseline the rest of the app works from, so re-derive every Amount
// from its percentage. If the document gave no percentages, derive them
// from each amount's share of the schedule total first.
function normalizePaymentAmounts(data: ExtractedProjectData): ExtractedProjectData {
  const fee = Number(data.totalFee) || 0;
  const terms = data.paymentTerms || [];
  if (fee <= 0 || terms.length === 0) return data;

  const pctSum = terms.reduce((sum, t) => sum + (Number(t.paymentPercentage) || 0), 0);
  const amountSum = terms.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const paymentTerms = terms.map((t) => {
    const pct =
      pctSum > 0
        ? Number(t.paymentPercentage) || 0
        : amountSum > 0
          ? ((Number(t.amount) || 0) / amountSum) * 100
          : 0;
    return { ...t, paymentPercentage: pct, amount: Math.round((fee * pct) / 100) };
  });
  return { ...data, paymentTerms };
}

// 503 "high demand" / 429 rate-limit errors are documented by Google as
// temporary, so they're worth retrying with a growing backoff.
function isOverloadError(err: any): boolean {
  const message = String(err?.message || err);
  return /\b(503|429)\b|overloaded|high demand|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(message);
}

// The SDK reports its own timeout as an aborted request.
function isTimeoutError(err: any): boolean {
  const message = String(err?.message || err);
  return err?.name === "AbortError" || /aborted|timed? ?out/i.test(message);
}

async function generateWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  contentParts: any[],
  modelName: string,
  maxAttempts = 3
) {
  const backoffMs = [2000, 5000];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await model.generateContent(contentParts, { timeout: 120000 });
    } catch (err: any) {
      // A timed-out call already burned up to 2 minutes; retrying the same
      // model again would just double the wait, so let the caller move on.
      if (isOverloadError(err) && attempt < maxAttempts) {
        const delay = backoffMs[attempt - 1] ?? 5000;
        console.warn(`Model ${modelName} is overloaded (attempt ${attempt}), retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Model ${modelName} failed after ${maxAttempts} attempts`);
}

export async function extractWithGemini(
  base64Data: string,
  mimeType: string,
  apiKey: string,
  preferredModel?: string,
  pdfText?: string,
  filename?: string
): Promise<ExtractedProjectData> {
  const genAI = new GoogleGenerativeAI(apiKey.trim());

  // gemini-2.0-flash and the 1.5 generation have been fully retired by Google
  // (requests now 404) — keep this list to models that are actually live.
  // gemini-flash-lite-latest is a last resort: it runs on separate capacity,
  // so it usually still answers when the full Flash models are overloaded.
  const fallbackModels = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-lite-latest"];
  const primaryModel =
    preferredModel && preferredModel !== "auto" ? preferredModel : fallbackModels[0];
  // De-duplicated so a slow/failing model never gets retried twice before
  // the loop moves on to an actually different fallback.
  const candidateModels = Array.from(new Set([primaryModel, ...fallbackModels].filter(Boolean)));

    const prompt = `You are an expert document extraction system. Extract the attached PDF into the JSON schema exactly.

  Accuracy rules:
  - Inspect every page of the attached PDF, including headers, footers, tables, and the final page.
  - Use the PDF layout as the source of truth. The extracted text is supporting context and may have broken table columns.
  - Transcribe values exactly; do not guess, infer, round, or replace a missing value with a sample/default value.
  - Keep currency symbols and commas out of numeric fields, but preserve the numeric value including decimals.
  - Extract every row in each fee, time frame, and payment table. Do not merge rows or omit rows with zero/blank amounts.
  - For payment percentages and amounts, copy both values from the document. Do not recalculate one from the other.
  - If a text field is not present, return an empty string. If a numeric field is not present, return 0.
  - Return only valid JSON matching the schema.

  Fields to extract:

0. Issuing Company:
    - companyName: Identify which company issued the document from its letterhead/logo/footer. Must be exactly "Whitespace Partners" or "Whitespaceconnect" — pick whichever one matches the document. Empty string if neither name appears anywhere in the document.

1. Project Brief:
    - projectName: Exact project name

2. Design Fees:
    - totalFee: The Total Fee amount (before VAT) — the highlighted total, or Sub Total minus any discount if that's what's shown.

3. Estimated Time Frame:
    - All phases/stages and their exact descriptions and durations, excluding any overall summary/total row.
    - totalDesignDuration: The overall total design duration text, if the document states one separately from the phases.

4. Payment Term & Schedule:
    - All milestone installments with their exact name, percentage, and amount.`;

  const attemptErrors: string[] = [];
  let allTransient = true;

  for (const modelName of candidateModels) {
    try {
      console.log(`Calling Gemini model: ${modelName}...`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: EXTRACTION_JSON_SCHEMA as any,
        },
      });

      const textContext = pdfText && pdfText.length > 30
        ? `\n\n=== EXTRACTED PDF TEXT (SUPPORTING CONTEXT ONLY) ===\n${buildTextContext(pdfText)}\n=== END EXTRACTED PDF TEXT ===`
        : "";
      const fullPrompt = `${prompt}${textContext}`;

      const contentParts: any[] = [fullPrompt, {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || "application/pdf",
        },
      }];

      console.log(`Sending original PDF${pdfText ? ` with ${pdfText.length} chars of supporting text` : ""} to Gemini ${modelName}...`);
      // Without an explicit timeout the SDK never aborts a stuck/slow call, so
      // a bad attempt could hang indefinitely before the loop below ever gets
      // to try the next fallback model. 120s gives large PDFs enough headroom
      // even when Gemini is under load.
      const result = await generateWithRetry(model, contentParts, modelName);
      const responseText = result.response.text();

      if (responseText) {
        const cleanedJson = responseText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        const parsed = normalizePaymentAmounts(JSON.parse(cleanedJson) as ExtractedProjectData);
        console.log("Successfully extracted real data with", modelName, parsed.projectName);
        return parsed;
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      console.warn(`Model ${modelName} encountered error:`, message);
      attemptErrors.push(`${modelName}: ${message}`);
      if (!isOverloadError(err) && !isTimeoutError(err)) allTransient = false;
    }
  }

  // Include every attempt's failure reason (not just the last one) so the
  // real cause isn't hidden behind whichever model happened to fail last.
  if (attemptErrors.length === 0) {
    throw new Error("Could not extract data with Gemini AI. Please verify your API Key.");
  }
  const header = allTransient
    ? "Gemini มีผู้ใช้งานหนาแน่นชั่วคราว (ไม่ใช่ปัญหาจากไฟล์หรือ API Key) กรุณารอ 1-2 นาทีแล้วกด AI Extract อีกครั้ง"
    : "All Gemini models failed:";
  throw new Error(`${header}\n${attemptErrors.join("\n")}`);
}
