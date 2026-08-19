// src/lib/ai-cli-engine.ts — desktop-only bridge to a locally-installed
// LLM CLI (Claude Code `claude -p`, Codex `codex exec`, or anything else
// the user points it at). This is what lets the AI copilot "act like an
// LLM" without any new API key or per-token billing: it shells out to a
// CLI the user already has and is already signed into, the same
// agent-sh/agent-cmd scoped-shell mechanism lib/tauri.ts uses elsewhere.
//
// Safety note: the prompt text (chat history + tool results) is NEVER
// interpolated into the shell command string — it's written to a temp
// file with a name this module generates itself, then piped into the CLI
// over stdin. Only the user's own trusted `cliCommand` setting (something
// they typed once in Settings, not remote/chat content) appears inline in
// the script. That split is what keeps arbitrary chat text from ever
// being able to break out of the command line.
//
// This path only runs inside the desktop app (isTauri) and is best-effort:
// exact non-interactive flags vary by CLI/version, so any failure here
// should be caught by the caller and treated as "engine unavailable".

import { isTauri } from './runtime';

function randomFileName(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `sj-ai-${hex}.txt`;
}

// POSIX single-quote escaping: safe for arbitrary bytes in one shell word
function shQuote(s: string): string {
    return `'${s.replace(/'/g, `'\\''`)}'`;
}

const IS_WINDOWS =
    typeof navigator !== 'undefined' &&
    /Win/i.test(navigator.platform || navigator.userAgent);

export function cliEngineAvailable(): boolean {
    return isTauri;
}

export async function runLocalCli(
    cliCommand: string,
    prompt: string,
    timeoutMs = 60_000,
): Promise<string> {
    if (!isTauri) throw new Error('本機 CLI 僅支援桌面版');
    const command = cliCommand.trim();
    if (!command) throw new Error('尚未設定本機 CLI 指令');

    const { Command } = await import('@tauri-apps/plugin-shell');
    const { tempDir, join } = await import('@tauri-apps/api/path');
    const { writeTextFile, remove } = await import('@tauri-apps/plugin-fs');

    const dir = await tempDir();
    const path = await join(dir, randomFileName());
    await writeTextFile(path, prompt);

    try {
        // Windows paths can never contain a literal `"`, so wrapping in
        // double quotes needs no further escaping; POSIX gets the
        // general-purpose single-quote form.
        const script = IS_WINDOWS
            ? `type "${path}" | ${command}`
            : `cat ${shQuote(path)} | ${command}`;
        const cmd = IS_WINDOWS
            ? Command.create('agent-cmd', ['/C', script])
            : Command.create('agent-sh', ['-c', script]);

        const run = cmd.execute();
        const timeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('本機 CLI 逾時')), timeoutMs);
        });
        const out = await Promise.race([run, timeout]);
        // biome/ts don't know `out` is the resolved Command output here
        // because of the race, so re-narrow explicitly
        const result = out as Awaited<typeof run>;
        if (result.code !== 0) {
            throw new Error(
                `本機 CLI 結束碼 ${result.code}：${(result.stderr || result.stdout || '').trim().slice(0, 300)}`,
            );
        }
        const text = result.stdout.trim();
        if (!text) throw new Error('本機 CLI 沒有輸出');
        return text;
    } finally {
        await remove(path).catch(() => {});
    }
}
