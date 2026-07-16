import { spawn } from 'node:child_process';

/**
 * One place for how code-story talks to `claude -p` (the only sanctioned route to the user's
 * Claude plan): tools disabled, JSON envelope out, prompt on stdin. The eval harness
 * (tools/order-eval.mjs) imports this from the built dist so job and judge can't drift apart.
 */
export function invokeClaudeJson(prompt: string, model: string, cwd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', model, '--output-format', 'json', '--tools', ''], {
      cwd,
      timeout: timeoutMs,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', (e) => reject(new Error(`failed to spawn claude: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * The model's JSON answer out of the CLI envelope's `result` string, which may carry prose on
 * either side. Brace-balanced scan (string-literal aware) rather than a greedy regex — trailing
 * prose containing a `}` must not extend the match past the real object.
 */
export function extractJsonBlock(envelopeStdout: string): unknown {
  const envelope = JSON.parse(envelopeStdout) as { result?: unknown };
  if (typeof envelope.result !== 'string') throw new Error('claude envelope has no result string');
  const text = envelope.result;
  const start = text.indexOf('{');
  if (start < 0) throw new Error('no JSON object in model result');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
    } else if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('unbalanced JSON object in model result');
}
