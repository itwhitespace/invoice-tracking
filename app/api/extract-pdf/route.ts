import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractWithGemini } from "@/lib/gemini";
import { SAMPLE_PROJECT_DATA } from "@/lib/sample-data";
import { extractTextFromPDFBuffer } from "@/lib/pdf-parser";

// The Gemini key lives only on the server, so this endpoint must not be
// usable by anyone who isn't signed in with the Upload permission.
async function callerCanUpload(req: NextRequest): Promise<boolean> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return false;

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return false;

  const { data: allowed, error } = await supabase.rpc("app_has_perm", { p_perm: "create_proposal" });
  return !error && allowed === true;
}

export async function POST(req: NextRequest) {
  try {
    if (!(await callerCanUpload(req))) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์ใช้งาน กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const isMock = formData.get("isMock") === "true";

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided in request" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

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
          ? "สกัดข้อมูลด้วย AI Demo Preset (เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY)"
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
