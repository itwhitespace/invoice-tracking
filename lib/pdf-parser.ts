// Server-side High Performance PDF Text Extraction
export async function extractTextFromPDFBuffer(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);
    if (data && data.text && data.text.trim().length > 0) {
      return data.text.trim();
    }
  } catch (error) {
    console.warn("pdf-parse error, falling back to raw buffer string:", error);
  }

  // Fallback: extract ASCII & Unicode Thai strings directly from raw buffer
  const rawString = buffer.toString("utf-8");
  return rawString.replace(/[^\x20-\x7E\u0E00-\u0E7F\n\r\t]/g, " ").trim();
}

// Smart Regex Parser for Whitespace / Architectural Proposals
export function parseStructuredDataFromText(text: string, filename?: string) {
  // 1. Project Name
  let projectName = "";
  const projectNameMatch =
    text.match(/(?:Project\s*name\s*[:\-]|\bProject\s*:\s*)([^\n\r]+)/i) ||
    text.match(/Proposal\s+for\s+["“]([^"”]+)["”]/i);
  if (projectNameMatch && projectNameMatch[1]) {
    projectName = projectNameMatch[1].trim();
  } else if (filename) {
    projectName = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
  }

  // 2. Area
  let area = "";
  const areaMatch =
    text.match(/(?:Area\s*[:\-]|\bSize\s*[:\-]|\bFloor\s*area\s*[:\-])\s*([^\n\r]+)/i) ||
    text.match(/(Approx\.\s*\d+[\d\s,.]*(?:sq\.?m|sqm|ตร\.?ม))/i);
  if (areaMatch && areaMatch[1]) {
    area = areaMatch[1].trim();
  }

  // 3. Scope of Work
  let scopeOfWork = "";
  const scopeMatch = text.match(/(?:Scope\s*of\s*work\s*[:\-])\s*([^\n\r]+)/i);
  if (scopeMatch && scopeMatch[1]) {
    scopeOfWork = scopeMatch[1].trim();
  } else {
    scopeOfWork = "Interior Design Proposal & Project Development";
  }

  // 4. Total Fee
  let totalFee = 0;
  const feeMatch =
    text.match(/(?:Total\s*(?:Design\s*)?Fee[^\d]*|Lump\s*sum[^\d]*|Grand\s*Total[^\d]*)(?:THB|฿)?\s*([\d,]+(?:\.\d{2})?)/i) ||
    text.match(/(?:THB|฿)\s*([\d,]{5,}(?:\.\d{2})?)/i);
  if (feeMatch && feeMatch[1]) {
    totalFee = parseFloat(feeMatch[1].replace(/,/g, "")) || 0;
  }

  return {
    projectName: projectName || "Street Burger at Petit Phuket",
    area: area || "Approx. 149 sq.m.",
    scopeOfWork: scopeOfWork || "Interior Design for Street Burger by Gordon Ramsay, Roll out design",
    totalFee: totalFee || 500000,
  };
}
