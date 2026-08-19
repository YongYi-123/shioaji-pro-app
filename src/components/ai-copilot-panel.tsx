// src/components/ai-copilot-panel.tsx — read-only AI copilot: answers
// questions about positions, account data, quotes, K-bars, orders/deals,
// scanner/heatmap rankings, watchlists and locally-saved research notes.
// It only ever calls read-only tools (lib/ai-tools.ts) — there is no path
// from this panel to placing, modifying, or cancelling a real order.

import { NotebookPen, Send, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    askAssistant,
    type ChatTurn,
    type ToolCallRecord,
} from '../lib/ai-orchestrator';
import { cliEngineAvailable } from '../lib/ai-cli-engine';
import { useAiSettings, setAiSettings } from '../lib/ai-settings';
import {
    addResearchNote,
    deleteResearchNote,
    useResearchNotes,
} from '../lib/research-notes';
import * as styles from './ai-copilot-panel.css';

interface Message extends ChatTurn {
    id: string;
    toolCalls?: ToolCallRecord[];
    pending?: boolean;
}

const SUGGESTIONS = ['我的持倉', '帳戶餘額', '2330 現在多少', '今天漲幅排行'];

export function AiCopilotPanel() {
    const settings = useAiSettings();
    const cliAvailable = cliEngineAvailable();
    const notes = useResearchNotes();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [noteCode, setNoteCode] = useState('');
    const [noteTitle, setNoteTitle] = useState('');
    const [noteBody, setNoteBody] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    function saveNote() {
        if (!noteTitle.trim() && !noteBody.trim()) return;
        addResearchNote({
            code: noteCode,
            title: noteTitle.trim() || noteCode || '筆記',
            body: noteBody,
        });
        setNoteCode('');
        setNoteTitle('');
        setNoteBody('');
    }

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages]);

    async function send(text: string) {
        const question = text.trim();
        if (!question || busy) return;
        const history: ChatTurn[] = messages.map((m) => ({
            role: m.role,
            text: m.text,
        }));
        const userMsg: Message = {
            id: `u-${Date.now()}`,
            role: 'user',
            text: question,
        };
        const pendingMsg: Message = {
            id: `p-${Date.now()}`,
            role: 'assistant',
            text: '思考中…',
            pending: true,
        };
        setMessages((prev) => [...prev, userMsg, pendingMsg]);
        setInput('');
        setBusy(true);
        try {
            const reply = await askAssistant(question, history);
            setMessages((prev) =>
                prev
                    .filter((m) => m.id !== pendingMsg.id)
                    .concat({
                        id: `a-${Date.now()}`,
                        role: 'assistant',
                        text: reply.text,
                        toolCalls: reply.toolCalls,
                    }),
            );
        } catch (e) {
            setMessages((prev) =>
                prev
                    .filter((m) => m.id !== pendingMsg.id)
                    .concat({
                        id: `a-${Date.now()}`,
                        role: 'assistant',
                        text: `發生錯誤：${(e as Error).message}`,
                    }),
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={styles.wrap}>
            <div className={styles.banner}>
                <ShieldAlert size={12} />
                唯讀助理：只讀取資料，無法下單／改單／刪單，交易一律需自行手動確認
            </div>
            <div className={styles.toolbar}>
                <span className={styles.engineBadge}>
                    {settings.engine === 'cli' ? '本機 CLI' : '內建規則引擎（免費）'}
                </span>
                <button
                    className={styles.iconBtn}
                    onClick={() => {
                        setShowNotes((v) => !v);
                        setShowSettings(false);
                    }}
                    title={`本機研究筆記（${notes.length}）`}
                >
                    <NotebookPen size={13} />
                </button>
                <button
                    className={styles.iconBtnTight}
                    onClick={() => {
                        setShowSettings((v) => !v);
                        setShowNotes(false);
                    }}
                    title='引擎設定'
                >
                    <Sparkles size={13} />
                </button>
            </div>
            {showNotes && (
                <div className={styles.settingsPane}>
                    <div className={styles.settingsRow}>
                        <input
                            className={styles.cliInput}
                            style={{ maxWidth: '5rem' }}
                            value={noteCode}
                            onChange={(e) => setNoteCode(e.target.value)}
                            placeholder='代碼（可留空）'
                        />
                        <input
                            className={styles.cliInput}
                            value={noteTitle}
                            onChange={(e) => setNoteTitle(e.target.value)}
                            placeholder='標題'
                        />
                    </div>
                    <textarea
                        className={styles.textarea}
                        style={{ minHeight: '3.2rem' }}
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        placeholder='筆記內容 — 助理之後可以讀到這裡的內容'
                    />
                    <button className={styles.sendBtn} style={{ alignSelf: 'flex-end' }} onClick={saveNote}>
                        儲存筆記
                    </button>
                    {notes.length > 0 && (
                        <div className={styles.notesList}>
                            {notes.map((n) => (
                                <div key={n.id} className={styles.noteRow}>
                                    <span className={styles.noteMeta}>
                                        {n.code && `[${n.code}] `}
                                        {n.title}
                                    </span>
                                    <button
                                        className={styles.noteDelete}
                                        onClick={() => deleteResearchNote(n.id)}
                                        title='刪除'
                                    >
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {showSettings && (
                <div className={styles.settingsPane}>
                    <div className={styles.settingsRow}>
                        引擎
                        <button
                            className={styles.engineOpt[settings.engine === 'local' ? 'on' : 'off']}
                            onClick={() => setAiSettings({ engine: 'local' })}
                        >
                            內建規則引擎（免費、無需設定）
                        </button>
                        <button
                            className={
                                !cliAvailable
                                    ? styles.engineOpt.disabled
                                    : styles.engineOpt[settings.engine === 'cli' ? 'on' : 'off']
                            }
                            disabled={!cliAvailable}
                            onClick={() => cliAvailable && setAiSettings({ engine: 'cli' })}
                            title={cliAvailable ? '' : '僅桌面版支援'}
                        >
                            本機 CLI（Claude Code / Codex，僅桌面版）
                        </button>
                    </div>
                    {settings.engine === 'cli' && (
                        <div className={styles.settingsRow}>
                            指令
                            <input
                                className={styles.cliInput}
                                value={settings.cliCommand}
                                onChange={(e) =>
                                    setAiSettings({ cliCommand: e.target.value })
                                }
                                placeholder='claude -p'
                                spellCheck={false}
                            />
                        </div>
                    )}
                    <div className={styles.settingsRow}>
                        使用你本機已安裝、已登入的 CLI（例如 Claude Code 的 `claude -p`），
                        不會另外收費，也不會使用任何雲端 API 金鑰；失敗時會自動退回內建規則引擎。
                    </div>
                </div>
            )}
            <div className={styles.list} ref={listRef}>
                {messages.length === 0 && (
                    <div className={styles.bubble.assistant}>
                        你好，我可以幫你查持倉、帳務、報價、K線、排行榜、自選清單與本機研究筆記。
                    </div>
                )}
                {messages.map((m) => (
                    <div key={m.id} className={styles.bubbleRow[m.role]}>
                        <div
                            className={
                                m.pending
                                    ? styles.bubble.pending
                                    : styles.bubble[m.role]
                            }
                        >
                            {m.role === 'assistant' && !m.pending ? (
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {m.text}
                                </ReactMarkdown>
                            ) : (
                                m.text
                            )}
                            {m.toolCalls && m.toolCalls.length > 0 && (
                                <div className={styles.toolChips}>
                                    {m.toolCalls.map((tc, i) => (
                                        <span
                                            key={`${tc.name}-${i}`}
                                            className={styles.toolChip}
                                            title={tc.summary}
                                        >
                                            🔧 {tc.name}
                                            {!tc.ok && ' (失敗)'}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {messages.length === 0 && (
                <div className={styles.suggestRow}>
                    {SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            className={styles.suggestChip}
                            onClick={() => send(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
            <div className={styles.composer}>
                <textarea
                    className={styles.textarea}
                    value={input}
                    placeholder='問我持倉、報價、排行榜…'
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void send(input);
                        }
                    }}
                />
                <button
                    className={styles.sendBtn}
                    disabled={busy || !input.trim()}
                    onClick={() => void send(input)}
                >
                    <Send size={14} />
                </button>
            </div>
        </div>
    );
}
