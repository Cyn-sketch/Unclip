import { NextRequest, NextResponse } from "next/server";
import { runSandboxDiagnostic } from "@/lib/vercel-sandbox";

export async function GET(req: NextRequest) {
  try {
    const result = await runSandboxDiagnostic();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      {
        ok: false,
        sandboxStarted: false,
        commandsRun: [],
        stdout: "",
        stderr: message,
        exitCodes: [],
      },
      { status: 500 }
    );
  }
}
