import { Sandbox } from "@vercel/sandbox";

export interface SandboxDiagnosticResult {
  ok: boolean;
  sandboxStarted: boolean;
  commandsRun: string[];
  stdout: string;
  stderr: string;
  exitCodes: (number | null)[];
  error?: string;
}

export async function runSandboxDiagnostic(): Promise<SandboxDiagnosticResult> {
  const commandsToRun = [
    "node -v",
    "ffmpeg -version || which ffmpeg || echo 'ffmpeg not found'",
    "uname -a",
    "cat /proc/cpuinfo | grep 'model name' | head -n 4 || lscpu || echo 'CPU info unavailable'",
    "cat /proc/meminfo | grep 'MemTotal' || free -h || echo 'Memory info unavailable'",
    "curl -s -I -m 5 https://huggingface.co | head -n 5 || echo 'Outbound HTTPS failed'",
  ];

  const result: SandboxDiagnosticResult = {
    ok: false,
    sandboxStarted: false,
    commandsRun: commandsToRun,
    stdout: "",
    stderr: "",
    exitCodes: [],
  };

  let sandbox: Sandbox | null = null;
  const stdoutArr: string[] = [];
  const stderrArr: string[] = [];

  try {
    const customImage = process.env.VERCEL_SANDBOX_IMAGE;
    
    // Explicit timeout safely below Hobby's 45-minute maximum (e.g. 5 minutes / 300,000 ms)
    const options: Parameters<typeof Sandbox.create>[0] = {
      timeout: 300000,
    };

    if (customImage && customImage.trim().length > 0) {
      options.image = customImage.trim();
    }

    // 1. Create Sandbox instance
    sandbox = await Sandbox.create(options);
    result.sandboxStarted = true;

    // 2. Run diagnostic commands inside Sandbox
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
