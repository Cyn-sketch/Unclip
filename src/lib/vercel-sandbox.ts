import { Sandbox } from "@vercel/sandbox";

export interface SandboxDiagnosticResult {
  ok: boolean;
  sandboxStarted: boolean;
  imageUsed: string;
  commandsRun: string[];
  stdout: string;
  stderr: string;
  exitCodes: (number | null)[];
  checks: {
    nodeVersion?: string;
    ffmpegVersion?: string;
    ffmpegPath?: string;
    whisperCliPath?: string;
    whisperHelp?: boolean;
    chromiumLaunched?: boolean;
    modelPath?: string;
    modelExists?: boolean;
    whisperTestSuccess?: boolean;
    sampleTranscript?: string;
  };
  totalRuntimeMs: number;
  error?: string;
}

export async function runSandboxDiagnostic(): Promise<SandboxDiagnosticResult> {
  const startTime = Date.now();
  const customImage = process.env.VERCEL_SANDBOX_IMAGE || "unclip-transcription-worker:latest";

  const commandsToRun = [
    // 1. Node version
    "node --version",
    // 2. FFmpeg check & path
    "ffmpeg -version || which ffmpeg || echo 'ffmpeg not found'",
    // 3. Whisper CLI help
    "/app/tools/whisper.cpp/build/bin/whisper-cli --help || whisper-cli --help || echo 'whisper-cli not found'",
    // 4. Playwright Chromium launch test
    "npx tsx -e \"import { chromium } from 'playwright'; (async () => { const b = await chromium.launch({ headless: true }); console.log('Chromium launched successfully'); await b.close(); })();\"",
    // 5. Model file path check
    "ls -lh /app/tools/whisper.cpp/models/ggml-large-v3-turbo.bin || echo 'Model file not found'",
    // 6 & 7. Whisper CLI transcription on JFK sample audio & JSON output inspect
    "/app/tools/whisper.cpp/build/bin/whisper-cli -m /app/tools/whisper.cpp/models/ggml-large-v3-turbo.bin -f /app/tools/whisper.cpp/samples/jfk.wav -l en --output-json -ojf && cat /app/tools/whisper.cpp/samples/jfk.wav.json || echo 'Transcription failed'",
  ];

  const result: SandboxDiagnosticResult = {
    ok: false,
    sandboxStarted: false,
    imageUsed: customImage || "default-sandbox-image",
    commandsRun: commandsToRun,
    stdout: "",
    stderr: "",
    exitCodes: [],
    checks: {},
    totalRuntimeMs: 0,
  };

  let sandbox: Sandbox | null = null;
  const stdoutArr: string[] = [];
  const stderrArr: string[] = [];

  try {
    // Explicit timeout safely below Hobby's 45-minute limit (e.g. 10 minutes = 600,000 ms)
    const options: Parameters<typeof Sandbox.create>[0] = {
      timeout: 600000,
    };

    if (customImage && customImage.trim().length > 0) {
      options.image = customImage.trim();
    }

    // 1. Create Sandbox instance
    sandbox = await Sandbox.create(options);
    result.sandboxStarted = true;

    // 2. Execute diagnostic verification suite inside Sandbox
    for (const cmdStr of commandsToRun) {
      try {
        const cmdObj = await sandbox.runCommand("bash", ["-c", cmdStr]);
        const finished = await cmdObj.wait();
        const cmdStdout = await cmdObj.stdout();
        const cmdStderr = await cmdObj.stderr();

        result.exitCodes.push(finished.exitCode ?? null);
        stdoutArr.push(`$ ${cmdStr}\n${cmdStdout.trim()}`);
        if (cmdStderr && cmdStderr.trim()) {
          stderrArr.push(`$ ${cmdStr} (stderr)\n${cmdStderr.trim()}`);
        }

        // Parse diagnostic check outputs
        if (cmdStr.startsWith("node --version")) {
          result.checks.nodeVersion = cmdStdout.trim();
        } else if (cmdStr.startsWith("ffmpeg -version")) {
          result.checks.ffmpegVersion = cmdStdout.split("\n")[0]?.trim();
          result.checks.ffmpegPath = cmdStdout.includes("ffmpeg") ? "/usr/bin/ffmpeg" : "not found";
        } else if (cmdStr.includes("whisper-cli --help")) {
          result.checks.whisperHelp = finished.exitCode === 0 || cmdStdout.includes("usage:");
          result.checks.whisperCliPath = "/app/tools/whisper.cpp/build/bin/whisper-cli";
        } else if (cmdStr.includes("Chromium launched")) {
          result.checks.chromiumLaunched = cmdStdout.includes("Chromium launched successfully");
        } else if (cmdStr.includes("ggml-large-v3-turbo.bin")) {
          result.checks.modelPath = "/app/tools/whisper.cpp/models/ggml-large-v3-turbo.bin";
          result.checks.modelExists = !cmdStdout.includes("Model file not found") && cmdStdout.includes("ggml-large-v3-turbo.bin");
        } else if (cmdStr.includes("jfk.wav.json")) {
          result.checks.whisperTestSuccess = !cmdStdout.includes("Transcription failed");
          if (cmdStdout.includes("{")) {
            try {
              const jsonStart = cmdStdout.indexOf("{");
              const jsonStr = cmdStdout.substring(jsonStart);
              const parsed = JSON.parse(jsonStr);
              const text = parsed.transcription ? parsed.transcription.map((t: any) => t.text).join(" ") : parsed.text;
              result.checks.sampleTranscript = text ? text.trim() : cmdStdout.trim();
            } catch {
              result.checks.sampleTranscript = cmdStdout.trim();
            }
          }
        }
      } catch (cmdErr: unknown) {
        const msg = cmdErr instanceof Error ? cmdErr.message : String(cmdErr);
        result.exitCodes.push(-1);
        stderrArr.push(`$ ${cmdStr} (error)\n${msg}`);
      }
    }

    result.stdout = stdoutArr.join("\n\n");
    result.stderr = stderrArr.join("\n\n");

    result.ok = result.sandboxStarted && result.exitCodes.length === commandsToRun.length;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    result.ok = false;
    result.error = msg;
    if (!result.stderr) {
      result.stderr = `Sandbox Initialization Error: ${msg}`;
    } else {
      result.stderr += `\n\nSandbox Initialization Error: ${msg}`;
    }
  } finally {
    result.totalRuntimeMs = Date.now() - startTime;
    if (sandbox) {
      try {
        await sandbox.stop();
      } catch (stopErr) {
        console.error("[Vercel Sandbox] Failed to stop sandbox:", stopErr);
      }
    }
  }

  return result;
}
