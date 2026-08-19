// src/lib/ai-router.ts — the free, zero-setup AI copilot engine: a small
// deterministic router that reads the user's question, decides which
// read-only tool (lib/ai-tools.ts) answers it, calls it, and formats the
// result as markdown. No LLM, no API key, no network call beyond the
// local shioaji server — this is what "decide which tools to call" means
// when no smarter engine (lib/ai-cli-engine.ts) is configured or available.
//
// There is deliberately no "place an order" intent: trading requests are
// always deflected to the manual order UI (see TRADE_INTENT below).

import { resolveSymbol, runTool } from './ai-tools';
import type { StockPosition, FuturePosition } from './types/portfolio';
import type { Trade } from './types/order';

export type Intent =
    | 'positions'
    | 'balance'
    | 'trades'
    | 'quote'
    | 'kbars'
    | 'scanner'
    | 'watchlists'
    | 'notes'
    | 'trade_action'
    | 'unknown';

interface IntentRule {
    intent: Intent;
    pattern: RegExp;
    needsSymbol?: boolean;
}

// order matters — more specific rules first (e.g. "trade_action" must not
// swallow "quote" questions that happen to mention 買賣 in passing, so it's
// checked with a narrower verb+price/quantity shaped pattern)
const RULES: IntentRule[] = [
    {
        intent: 'trade_action',
        pattern: /(下單|買進|買入|賣出|買\d|賣\d|平倉|建倉|加碼|減碼|掛單|幫我買|幫我賣|place\s*(an?\s*)?order|\bbuy\b|\bsell\b)/i,
    },
    { intent: 'positions', pattern: /(持倉|部位|庫存|position)/i },
    { intent: 'balance', pattern: /(餘額|權益|保證金|風險指標|margin|balance|equity)/i },
    { intent: 'trades', pattern: /(委託|訂單|成交明細|成交紀錄|deal|order|trade)/i },
    { intent: 'kbars', pattern: /(k\s*線|k\s*棒|kbar|歷史.*(價|走勢)|history)/i, needsSymbol: true },
    { intent: 'scanner', pattern: /(排行|熱門|漲幅榜|跌幅榜|量增|熱力圖|heatmap|scanner|ranking)/i },
    { intent: 'watchlists', pattern: /(自選|觀察清單|watchlist)/i },
    { intent: 'notes', pattern: /(筆記|研究|note)/i },
    {
        intent: 'quote',
        pattern: /(報價|股價|現價|市價|價位|漲跌|多少錢|多少|quote|price)/i,
        needsSymbol: true,
    },
];

// pulls a plausible symbol query out of free text: a bare 4-6 digit code,
// or (fallback) the question itself minus matched keywords/punctuation
function extractSymbolQuery(question: string, matched: RegExp): string | null {
    const codeMatch = question.match(/\b\d{4,6}\b/);
    if (codeMatch) return codeMatch[0];
    const stripped = question
        .replace(matched, ' ')
        .replace(/[?？!!。，,]/g, ' ')
        .trim();
    return stripped || null;
}

export function detectIntent(question: string): {
    intent: Intent;
    symbolQuery: string | null;
} {
    const trimmed = question.trim();
    for (const rule of RULES) {
        if (rule.pattern.test(trimmed)) {
            return {
                intent: rule.intent,
                symbolQuery: rule.needsSymbol
                    ? extractSymbolQuery(trimmed, rule.pattern)
                    : null,
            };
        }
    }
    return { intent: 'unknown', symbolQuery: null };
}

function fmtNum(n: number | undefined | null): string {
    if (n === undefined || n === null || Number.isNaN(n)) return '—';
    return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

function posTable(rows: (StockPosition | FuturePosition)[]): string {
    if (rows.length === 0) return '（無持倉）';
    const lines = [
        '| 代碼 | 方向 | 數量 | 均價 | 現價 | 損益 |',
        '|---|---|---|---|---|---|',
    ];
    for (const p of rows) {
        lines.push(
            `| ${p.code} | ${p.direction === 'Buy' ? '買' : '賣'} | ${fmtNum(p.quantity)} | ${fmtNum(p.price)} | ${fmtNum(p.last_price)} | ${fmtNum(p.pnl)} |`,
        );
    }
    return lines.join('\n');
}

function tradesTable(trades: Trade[]): string {
    if (trades.length === 0) return '（無資料）';
    const lines = [
        '| 代碼 | 買賣 | 價格 | 數量 | 狀態 | 已成交 |',
        '|---|---|---|---|---|---|',
    ];
    for (const t of trades.slice(0, 20)) {
        lines.push(
            `| ${t.contract.code} | ${t.order.action === 'Buy' ? '買' : '賣'} | ${fmtNum(t.order.price)} | ${fmtNum(t.order.quantity)} | ${t.status.status} | ${fmtNum(t.status.deal_quantity)} |`,
        );
    }
    if (trades.length > 20) lines.push(`\n_...共 ${trades.length} 筆，僅顯示前 20 筆_`);
    return lines.join('\n');
}

export async function runLocalRouter(question: string): Promise<string> {
    const { intent, symbolQuery } = detectIntent(question);

    if (intent === 'trade_action') {
        return (
            '我只能讀取資料，**無法直接下單／改單／刪單**。' +
            '如果要交易，請自行到下單面板／閃電下單操作並手動確認 —' +
            '這是為了避免任何自動化程式誤觸真實委託。'
        );
    }

    try {
        switch (intent) {
            case 'positions': {
                const result = (await runTool('get_positions', {})) as {
                    accountType: string;
                    positions: (StockPosition | FuturePosition)[];
                    error?: string;
                }[];
                return result
                    .map(
                        (r) =>
                            `**${r.accountType === 'S' ? '證券' : '期貨'}持倉**\n\n${
                                r.error ? `讀取失敗：${r.error}` : posTable(r.positions)
                            }`,
                    )
                    .join('\n\n');
            }
            case 'balance': {
                const result = (await runTool('get_account_balance', {})) as {
                    balance: { acc_balance: number; date: string } | null;
                    margin: { equity: number; available_margin: number; risk_indicator: number } | null;
                };
                const parts: string[] = [];
                if (result.balance) {
                    parts.push(
                        `**證券帳戶餘額**：${fmtNum(result.balance.acc_balance)}（${result.balance.date}）`,
                    );
                }
                if (result.margin) {
                    parts.push(
                        `**期貨權益數**：${fmtNum(result.margin.equity)}　**可用保證金**：${fmtNum(result.margin.available_margin)}　**風險指標**：${fmtNum(result.margin.risk_indicator)}%`,
                    );
                }
                return parts.length > 0 ? parts.join('\n\n') : '沒有可用的帳務資料。';
            }
            case 'trades': {
                const activeOnly = /(未成交|進行中|active|pending)/i.test(question);
                const result = (await runTool('get_trades', { activeOnly })) as {
                    accountType: string;
                    trades: Trade[];
                    error?: string;
                }[];
                return result
                    .map(
                        (r) =>
                            `**${r.accountType === 'S' ? '證券' : '期貨'}${activeOnly ? '未完成' : ''}委託**\n\n${
                                r.error ? `讀取失敗：${r.error}` : tradesTable(r.trades)
                            }`,
                    )
                    .join('\n\n');
            }
            case 'quote': {
                if (!symbolQuery) return '請告訴我要查哪一檔商品（代碼或名稱）。';
                const contract = await resolveSymbol(symbolQuery);
                const result = (await runTool('get_quote', {
                    symbol: contract.code,
                })) as {
                    snapshot: {
                        close: number;
                        change_price: number;
                        change_rate: number;
                        open: number;
                        high: number;
                        low: number;
                        volume: number;
                    } | null;
                };
                if (!result.snapshot) return `${contract.name}（${contract.code}）目前沒有快照資料（可能未開盤）。`;
                const s = result.snapshot;
                return (
                    `**${contract.name}（${contract.code}）**\n\n` +
                    `現價 ${fmtNum(s.close)}　漲跌 ${fmtNum(s.change_price)}（${fmtNum(s.change_rate)}%）\n\n` +
                    `開 ${fmtNum(s.open)}　高 ${fmtNum(s.high)}　低 ${fmtNum(s.low)}　量 ${fmtNum(s.volume)}`
                );
            }
            case 'kbars': {
                if (!symbolQuery) return '請告訴我要查哪一檔商品的 K 線。';
                const contract = await resolveSymbol(symbolQuery);
                const result = (await runTool('get_kbars', {
                    symbol: contract.code,
                })) as {
                    kbars: { datetime: string[]; Close: number[]; Volume: number[] };
                };
                const { datetime, Close, Volume } = result.kbars;
                const n = datetime.length;
                if (n === 0) return `${contract.name}（${contract.code}）沒有 K 線資料。`;
                const lines = [`**${contract.name}（${contract.code}）近 ${n} 根日K**`, '', '| 日期 | 收盤 | 量 |', '|---|---|---|'];
                for (let i = Math.max(0, n - 10); i < n; i++) {
                    lines.push(`| ${(datetime[i] ?? '').slice(0, 10)} | ${fmtNum(Close[i])} | ${fmtNum(Volume[i])} |`);
                }
                return lines.join('\n');
            }
            case 'scanner': {
                const ascending = /(跌|縮|drop|down)/i.test(question);
                const scannerType = /(量|volume)/i.test(question)
                    ? 'VolumeRank'
                    : /(額|amount)/i.test(question)
                      ? 'AmountRank'
                      : 'ChangePercentRank';
                const items = (await runTool('get_scanner', {
                    scannerType,
                    count: 10,
                    ascending,
                })) as { code: string; name: string; close: number; change_price: number }[];
                if (items.length === 0) return '目前沒有排行榜資料（可能非交易時段）。';
                const lines = ['**排行榜（前 10）**', '', '| 代碼 | 名稱 | 收盤 | 漲跌 |', '|---|---|---|---|'];
                for (const it of items) {
                    lines.push(`| ${it.code} | ${it.name} | ${fmtNum(it.close)} | ${fmtNum(it.change_price)} |`);
                }
                return lines.join('\n');
            }
            case 'watchlists': {
                const lists = (await runTool('get_watchlists', {})) as {
                    id: string;
                    name: string;
                    contracts: { code: string }[];
                }[];
                if (lists.length === 0) return '目前沒有自選清單。';
                return lists
                    .map((l) => `**${l.name}**：${l.contracts.map((c) => c.code).join('、') || '（空）'}`)
                    .join('\n\n');
            }
            case 'notes': {
                const symbol = symbolQuery && /\d{4,6}/.test(symbolQuery) ? symbolQuery : undefined;
                const notes = (await runTool('get_research_notes', { symbol })) as {
                    code: string;
                    title: string;
                    body: string;
                    ts: number;
                }[];
                if (notes.length === 0) return '沒有找到本機儲存的研究筆記。';
                return notes
                    .slice(0, 10)
                    .map(
                        (n) =>
                            `**${n.title}**${n.code ? `（${n.code}）` : ''} — ${new Date(n.ts).toLocaleDateString('zh-TW')}\n${n.body}`,
                    )
                    .join('\n\n');
            }
            default:
                return (
                    '我可以回答：持倉、帳務餘額、委託／成交、某檔商品報價或K線、' +
                    '排行榜／熱門股、自選清單、本機研究筆記。試著問我，例如「2330 現在多少」或「我的持倉」。'
                );
        }
    } catch (e) {
        return `查詢失敗：${(e as Error).message}`;
    }
}
