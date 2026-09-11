import { NextRequest, NextResponse } from "next/server";
import { extractWithGemini } from "@/lib/gemini";
import { SAMPLE_PROJECT_DATA } from "@/lib/sample-data";
import { extractTextFromPDFBuffer } from "@/lib/pdf-parser";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const customApiKey = formData.get("apiKey") as string | null;
    const isMock = formData.get("isMock") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided in request" },
        { status: 400 }
      );
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // If Mock mode requested or no API key is set yet, return realistic sample extraction with document name
    if (isMock || !apiKey) {
      // Simulate brief network delay for realism
      await new Promise((res) => setTimeout(res, 800));

      const mockData = {
        ...SAMPLE_PROJECT_DATA,
        projectName: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") || SAMPLE_PROJECT_DATA.projectName,
      };

      return NextResponse.json({
        success: true,
        data: mockData,
        isMock: true,
        message: !apiKey
          ? "สกัดข้อมูลด้วย AI Demo Preset (หากต้องการใช้ Gemini API จริง กรุณาใส่ API Key ในปุ่ม Settings)"
          : "Extraction successful (Demo mode)",
      });
    }

    const customModel = formData.get("model") as string | null;

    // Extract PDF ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "application/pdf";

    // Fast local text extraction
    let pdfText = "";
    try {
      pdfText = await extractTextFromPDFBuffer(buffer);
    } catch (e) {
      console.warn("Local PDF text extract warning:", e);
    }

    const extractedData = await extractWithGemini(
      base64Data,
      mimeType,
      apiKey,
      customModel || undefined,
      pdfText,
      file.name
    );

    return NextResponse.json({
      success: true,
      data: extractedData,
      isMock: false,
    });
  } catch (error: any) {
    console.error("API /api/extract-pdf error:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to process PDF with Gemini AI",
      },
      { status: 500 }
    );
  }
}
