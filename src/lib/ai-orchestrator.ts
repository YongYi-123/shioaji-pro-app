// src/lib/ai-orchestrator.ts — picks the configured AI engine and runs one
// question through it. The 'cli' engine (real LLM reasoning via the user's
// own local Claude Code / Codex CLI) still only ever executes tools from
// AI_TOOLS — the model can pick a tool by name, but this module is the one
// that actually calls it, so it's still impossible for a chat turn to
// reach any order-placing code path even if the CLI hallucinated one.

import { AI_TOOLS, runTool } from './ai-tools';
import { runLocalRouter } from './ai-router';
import { cliEngineAvailable, runLocalCli } from './ai-cli-engine';
import { getAiSettings } from './ai-settings';

export interface ChatTurn {
    role: 'user' | 'assistant';
    text: string;
}

export interface ToolCallRecord {
    name: string;
    args: Record<string, unknown>;
    ok: boolean;
    summary: string;
}

export interface AssistantReply {
    text: string;
    toolCalls: ToolCallRecord[];
    engine: 'local' | 'cli';
}

const SYSTEM_NOTE =
    '你是一個唯讀的股票交易終端資料助理。你只能讀取資料，完全沒有下單/改單/刪單的能力。' +
    '若使用者要求任何交易操作，一律回覆：無法代為下單，請自行到下單面板手動操作並確認。' +
    '回覆一律使用繁體中文，簡潔，只根據提供的工具結果回答，不要編造數字或臆測未提供的資料。';

function toolCatalogText(): string {
    return AI_TOOLS.map((t) => {
        const params = t.params
            .map(
                (p) =>
                    `${p.name}${p.required === false ? '?' : ''}: ${p.type}${
                        p.enum ? `(${p.enum.join('|')})` : ''
                    } — ${p.description}`,
            )
            .join('; ');
        return `- ${t.name}: ${t.description}${params ? ` [參數: ${params}]` : ''}`;
    }).join('\n');
}

function extractJson(text: string): { tool?: string | null; args?: Record<string, unknown> } {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = fence?.[1] ?? text;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
        throw new Error('本機 CLI 未回傳有效 JSON');
    }
    return JSON.parse(body.slice(start, end + 1)) as {
        tool?: string | null;
        args?: Record<string, unknown>;
    };
}

async function runCliFlow(
    question: string,
    history: ChatTurn[],
    cliCommand: string,
): Promise<AssistantReply> {
    const historyText = history
        .slice(-6)
        .map((h) => `${h.role === 'user' ? '使用者' : '助理'}：${h.text}`)
        .join('\n');

    const pickPrompt = `${SYSTEM_NOTE}

可用的唯讀工具：
${toolCatalogText()}

最近對話：
${historyText || '（無）'}

使用者問題：${question}

判斷回答這個問題最多需要呼叫一個工具。只回傳 JSON，不要加任何其他文字或說明：
{"tool": "工具名稱或 null", "args": {符合上面參數說明的物件}}`;

    const pickRaw = await runLocalCli(cliCommand, pickPrompt);
    const picked = extractJson(pickRaw);

    const toolCalls: ToolCallRecord[] = [];
    let toolResultText = '（這個問題不需要呼叫工具）';
    if (picked.tool) {
        try {
            const result = await runTool(picked.tool, picked.args ?? {});
            toolCalls.push({
                name: picked.tool,
                args: picked.args ?? {},
                ok: true,
                summary: 'OK',
            });
            toolResultText = JSON.stringify(result).slice(0, 6000);
        } catch (e) {
            const message = (e as Error).message;
            toolCalls.push({
                name: picked.tool,
                args: picked.args ?? {},
                ok: false,
                summary: message,
            });
            toolResultText = `工具執行失敗：${message}`;
        }
    }

    const answerPrompt = `${SYSTEM_NOTE}

使用者問題：${question}

工具「${picked.tool ?? '無'}」的結果（JSON）：
${toolResultText}

請根據以上資料，用繁體中文簡潔回答使用者的問題。`;

    const answer = await runLocalCli(cliCommand, answerPrompt);
    return { text: answer, toolCalls, engine: 'cli' };
}

export async function askAssistant(
    question: string,
    history: ChatTurn[],
): Promise<AssistantReply> {
    const settings = getAiSettings();
    if (settings.engine === 'cli' && cliEngineAvailable()) {
        try {
            return await runCliFlow(question, history, settings.cliCommand);
        } catch (e) {
            const fallback = await runLocalRouter(question);
            return {
                text: `_（本機 CLI 呼叫失敗：${(e as Error).message}，已改用內建規則引擎回答）_\n\n${fallback}`,
                toolCalls: [],
                engine: 'local',
            };
        }
    }
    const text = await runLocalRouter(question);
    return { text, toolCalls: [], engine: 'local' };
}
