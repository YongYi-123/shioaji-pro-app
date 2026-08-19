// src/lib/ai-tools.ts — read-only tool layer for the AI copilot.
//
// Every tool here only READS local shioaji-server / in-app data. There is
// no order/cancel/modify/watchlist-write tool in this module, on purpose:
// the copilot must never be able to touch a real position or order by
// itself. Any trading action stays a manual step in the existing order
// ticket / flash-order / grid UI, with the app's normal two-step confirm.

import {
    fetchAccountBalance,
    fetchAccounts,
    fetchKbars,
    fetchMargin,
    fetchPositions,
    fetchProfitLoss,
    fetchScanner,
    fetchSnapshots,
    fetchTrades,
    fetchWatchlists,
    resolveContract,
} from './shioaji';
import { searchProducts } from './product-search';
import { listResearchNotes } from './research-notes';
import type { AccountTypeName } from './types/portfolio';
import type { KBars, ScannerType } from './types/market';
import { ACTIVE_ORDER_STATUSES } from './types/order';
import type { ContractInfo } from './types/contract';
import { todayStr } from './utils/date';

export interface AiToolParam {
    name: string;
    type: 'string' | 'number' | 'boolean';
    description: string;
    required?: boolean;
    enum?: string[];
}

export interface AiTool {
    name: string;
    description: string;
    params: AiToolParam[];
    run: (args: Record<string, unknown>) => Promise<unknown>;
}

function str(
    name: string,
    description: string,
    required = true,
    enumValues?: string[],
): AiToolParam {
    return { name, type: 'string', description, required, enum: enumValues };
}

function num(name: string, description: string): AiToolParam {
    return { name, type: 'number', description, required: false };
}

function bool(name: string, description: string): AiToolParam {
    return { name, type: 'boolean', description, required: false };
}

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// kbars come back as parallel column arrays that can span years — keep the
// tool's reply small by returning only the most recent `limit` bars
function capKbars(kbars: KBars, limit: number): KBars {
    const n = kbars.datetime.length;
    if (n <= limit) return kbars;
    const from = n - limit;
    return {
        datetime: kbars.datetime.slice(from),
        Open: kbars.Open.slice(from),
        High: kbars.High.slice(from),
        Low: kbars.Low.slice(from),
        Close: kbars.Close.slice(from),
        Volume: kbars.Volume.slice(from),
        Amount: kbars.Amount.slice(from),
    };
}

// resolves a free-text symbol (code like "2330" or a Chinese/English name
// like "台積電") to a full contract — tries the exact-code path first since
// it's a single request, falls back to fuzzy name search
export async function resolveSymbol(query: string): Promise<ContractInfo> {
    const trimmed = query.trim();
    if (!trimmed) throw new Error('缺少商品代碼或名稱');
    try {
        return await resolveContract(trimmed);
    } catch {
        // not a bare code — try name/code fuzzy search
    }
    const hits = await searchProducts(trimmed, 1);
    const hit = hits[0];
    if (!hit) throw new Error(`找不到商品「${trimmed}」`);
    return resolveContract(hit.code, hit.security_type);
}

function contractSummary(c: ContractInfo) {
    return {
        code: c.code,
        name: c.name,
        security_type: c.security_type,
        exchange: c.exchange,
    };
}

export const AI_TOOLS: AiTool[] = [
    {
        name: 'get_accounts',
        description: '取得已連結的證券／期貨帳戶清單（帳號、是否已簽署）',
        params: [],
        run: async () => fetchAccounts(),
    },
    {
        name: 'get_positions',
        description: '取得目前持倉部位（股票與期貨），含未實現損益',
        params: [
            str(
                'accountType',
                '帳戶類型：S=證券 F=期貨，留空查全部',
                false,
                ['S', 'F'],
            ),
        ],
        run: async (args) => {
            const only = args.accountType as AccountTypeName | undefined;
            const types: AccountTypeName[] = only ? [only] : ['S', 'F'];
            return Promise.all(
                types.map(async (accountType) => {
                    try {
                        return {
                            accountType,
                            positions: await fetchPositions(accountType),
                        };
                    } catch (e) {
                        return {
                            accountType,
                            positions: [],
                            error: (e as Error).message,
                        };
                    }
                }),
            );
        },
    },
    {
        name: 'get_account_balance',
        description: '取得證券帳戶餘額，以及期貨保證金／權益數／風險指標',
        params: [],
        run: async () => {
            const [balance, margin] = await Promise.allSettled([
                fetchAccountBalance(),
                fetchMargin(),
            ]);
            return {
                balance:
                    balance.status === 'fulfilled' ? balance.value : null,
                margin: margin.status === 'fulfilled' ? margin.value : null,
            };
        },
    },
    {
        name: 'get_trades',
        description:
            '取得委託單與成交明細（訂單狀態、成交價量、可過濾只看未完成委託）',
        params: [
            str(
                'accountType',
                '帳戶類型：S=證券 F=期貨，留空查全部',
                false,
                ['S', 'F'],
            ),
            bool('activeOnly', '只列出還在委託中的單（未成交／部分成交）'),
        ],
        run: async (args) => {
            const only = args.accountType as AccountTypeName | undefined;
            const types: AccountTypeName[] = only ? [only] : ['S', 'F'];
            const activeOnly = !!args.activeOnly;
            const lists = await Promise.all(
                types.map(async (accountType) => {
                    try {
                        const trades = await fetchTrades(accountType);
                        return { accountType, trades };
                    } catch (e) {
                        return {
                            accountType,
                            trades: [],
                            error: (e as Error).message,
                        };
                    }
                }),
            );
            if (!activeOnly) return lists;
            return lists.map((l) => ({
                ...l,
                trades: l.trades.filter((t) =>
                    ACTIVE_ORDER_STATUSES.has(t.status.status),
                ),
            }));
        },
    },
    {
        name: 'get_profit_loss',
        description: '取得已實現損益紀錄（可指定日期區間，預設查今天）',
        params: [
            str(
                'accountType',
                '帳戶類型：S=證券 F=期貨，留空查全部',
                false,
                ['S', 'F'],
            ),
            str('beginDate', '起始日期 YYYY-MM-DD，預設今天', false),
            str('endDate', '結束日期 YYYY-MM-DD，預設今天', false),
        ],
        run: async (args) => {
            const only = args.accountType as AccountTypeName | undefined;
            const types: AccountTypeName[] = only ? [only] : ['S', 'F'];
            const begin = (args.beginDate as string) || todayStr();
            const end = (args.endDate as string) || todayStr();
            return Promise.all(
                types.map(async (accountType) => {
                    try {
                        return {
                            accountType,
                            records: await fetchProfitLoss(
                                accountType,
                                undefined,
                                begin,
                                end,
                            ),
                        };
                    } catch (e) {
                        return {
                            accountType,
                            records: [],
                            error: (e as Error).message,
                        };
                    }
                }),
            );
        },
    },
    {
        name: 'search_contract',
        description:
            '用代碼或中文／英文名稱搜尋商品，回傳最相近的候選（找不到確切代碼時先用這個）',
        params: [
            str('query', '搜尋關鍵字，如 2330 或 台積電'),
            num('limit', '回傳筆數上限，預設 5'),
        ],
        run: async (args) => {
            const limit = Number(args.limit) || 5;
            return searchProducts(String(args.query ?? ''), limit);
        },
    },
    {
        name: 'get_quote',
        description: '取得某商品的即時快照報價（開高低收、漲跌、成交量）',
        params: [str('symbol', '商品代碼或中文名稱，如 2330 或 台積電')],
        run: async (args) => {
            const contract = await resolveSymbol(String(args.symbol ?? ''));
            const [snapshot] = await fetchSnapshots([contract]);
            return { contract: contractSummary(contract), snapshot: snapshot ?? null };
        },
    },
    {
        name: 'get_kbars',
        description:
            '取得某商品的日 K 線資料（開高低收量），可指定日期區間，預設近 30 天',
        params: [
            str('symbol', '商品代碼或中文名稱'),
            str('start', '起始日期 YYYY-MM-DD，預設 30 天前', false),
            str('end', '結束日期 YYYY-MM-DD，預設今天', false),
        ],
        run: async (args) => {
            const contract = await resolveSymbol(String(args.symbol ?? ''));
            const end = (args.end as string) || todayStr();
            const start = (args.start as string) || daysAgo(30);
            const kbars = await fetchKbars(contract, start, end);
            return {
                contract: contractSummary(contract),
                kbars: capKbars(kbars, 120),
            };
        },
    },
    {
        name: 'get_scanner',
        description:
            '取得排行榜／掃描器資料（漲跌幅、成交量、成交額排名），用於找熱門股或當日焦點',
        params: [
            str(
                'scannerType',
                '排行類型，預設 ChangePercentRank（漲跌幅排行）',
                false,
                [
                    'ChangePercentRank',
                    'ChangePriceRank',
                    'DayRangeRank',
                    'VolumeRank',
                    'AmountRank',
                    'TickCountRank',
                ],
            ),
            num('count', '回傳筆數，預設 20'),
            bool('ascending', '是否由小到大排序（找跌幅/量縮榜用）'),
        ],
        run: async (args) => {
            const scannerType = (args.scannerType as ScannerType) || 'ChangePercentRank';
            const count = Number(args.count) || 20;
            return fetchScanner(scannerType, count, !!args.ascending);
        },
    },
    {
        name: 'get_watchlists',
        description: '取得使用者的自選清單分組與成分股',
        params: [],
        run: async () => fetchWatchlists(),
    },
    {
        name: 'get_research_notes',
        description: '取得使用者在本機儲存的個人研究筆記',
        params: [str('symbol', '只看特定代碼的筆記，留空看全部', false)],
        run: async (args) =>
            listResearchNotes(
                args.symbol ? String(args.symbol) : undefined,
            ),
    },
];

export function findTool(name: string): AiTool | undefined {
    return AI_TOOLS.find((t) => t.name === name);
}

export async function runTool(
    name: string,
    args: Record<string, unknown>,
): Promise<unknown> {
    const tool = findTool(name);
    if (!tool) throw new Error(`未知工具：${name}`);
    return tool.run(args ?? {});
}
