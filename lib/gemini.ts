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
    area: {
      type: SchemaType.STRING,
      description: "Exact area / space size as written in the document. Preserve units and qualifiers.",
    },
    scopeOfWork: {
      type: SchemaType.STRING,
      description: "Exact scope of work summary based only on the document; do not invent missing details.",
    },
    totalFee: {
      type: SchemaType.NUMBER,
      description: "Total Design Fee or Lump-sum amount as pure number (highlighted total)",
    },
    designFeeItems: {
      type: SchemaType.ARRAY,
      description: "ONLY the numbered/ordered line items from the Design Fees table (e.g. '1. Concept Design', '2. Schematic Design'). Do NOT include summary rows such as Sub Total, Special discount, Total Fee, VAT, or Grand Total — those go in specialDiscount / totalFee instead.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          item: { type: SchemaType.STRING, description: "Exact item title or scope category from the fee table" },
          description: { type: SchemaType.STRING, description: "Exact details, conditions or deliverable notes; empty string if none" },
          amount: { type: SchemaType.NUMBER, description: "Exact fee amount for this row as a number, without commas or currency symbols" },
        },
        required: ["item", "amount"],
      },
    },
    specialDiscount: {
      type: SchemaType.NUMBER,
      description: "Special discount amount subtracted from the Sub Total Fee, if stated in the document. 0 if none.",
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
  required: ["projectName", "area", "scopeOfWork", "totalFee", "designFeeItems", "timeFrames", "paymentTerms"],
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

// Google's 503 "high demand" errors are explicitly documented as usually
// temporary, so a short automatic retry is worth it before giving up on a
// model and moving to the next fallback.
async function generateWithRetry(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  contentParts: any[],
  modelName: string,
  maxAttempts = 2
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await model.generateContent(contentParts, { timeout: 90000 });
    } catch (err: any) {
      const isServiceUnavailable = String(err?.message || err).includes("503");
      if (isServiceUnavailable && attempt < maxAttempts) {
        console.warn(`Model ${modelName} returned 503 (high demand), retrying in 3s...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
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
  const fallbackModels = ["gemini-3.6-flash", "gemini-3.7-flash"];
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
    - area: Exact area/size text
    - scopeOfWork: Exact scope description

2. Design Fees (Extract the ENTIRE table):
    - designFeeItems: ONLY the numbered/ordered breakdown items (item name, description/deliverables, and amount). Do not include Sub Total, Special discount, Total Fee, VAT, or Grand Total rows here.
    - specialDiscount: The special discount amount, if any (0 if none).
    - totalFee: The Total Fee amount (Sub Total minus discount, before VAT).

3. Estimated Time Frame:
    - All phases/stages and their exact descriptions and durations, excluding any overall summary/total row.
    - totalDesignDuration: The overall total design duration text, if the document states one separately from the phases.

4. Payment Term & Schedule:
    - All milestone installments with their exact name, percentage, and amount.`;

  const attemptErrors: string[] = [];

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
      // to try the next fallback model. 90s gives large PDFs enough headroom.
      const result = await generateWithRetry(model, contentParts, modelName);
      const responseText = result.response.text();

      if (responseText) {
        const cleanedJson = responseText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        const parsed = JSON.parse(cleanedJson) as ExtractedProjectData;
        console.log("Successfully extracted real data with", modelName, parsed.projectName);
        return parsed;
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      console.warn(`Model ${modelName} encountered error:`, message);
      attemptErrors.push(`${modelName}: ${message}`);
    }
  }

  // Include every attempt's failure reason (not just the last one) so the
  // real cause isn't hidden behind whichever model happened to fail last.
  throw new Error(
    attemptErrors.length > 0
      ? `All Gemini models failed:\n${attemptErrors.join("\n")}`
      : "Could not extract data with Gemini AI. Please verify your API Key."
  );
}
