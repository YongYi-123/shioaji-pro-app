// src/lib/ai-settings.ts — AI copilot engine settings, persisted locally.
//
// 'local'  — built-in rule-based router. Zero setup, zero cost, works in
//            the browser and the desktop app alike.
// 'cli'    — desktop-only: pipes the question through the user's own
//            locally-installed Claude Code / Codex CLI (see
//            lib/ai-cli-engine.ts) so answers use real LLM reasoning
//            without any new API key or per-token billing — it rides
//            whatever subscription the CLI itself is already logged into.

import { useSyncExternalStore } from 'react';

export type AiEngine = 'local' | 'cli';

export interface AiSettings {
    engine: AiEngine;
    cliCommand: string;
}

const STORAGE_KEY = 'sj-pro-ai-settings';
const DEFAULTS: AiSettings = { engine: 'local', cliCommand: 'claude -p' };

function load(): AiSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        const s = JSON.parse(raw) as Partial<AiSettings>;
        return {
            engine: s.engine === 'cli' ? 'cli' : 'local',
            cliCommand:
                typeof s.cliCommand === 'string' && s.cliCommand.trim()
                    ? s.cliCommand
                    : DEFAULTS.cliCommand,
        };
    } catch {
        return { ...DEFAULTS };
    }
}

let settings = load();
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

export function setAiSettings(next: Partial<AiSettings>) {
    settings = { ...settings, ...next };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // session only
    }
    emit();
}

export function getAiSettings(): AiSettings {
    return settings;
}

export function useAiSettings(): AiSettings {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => settings,
    );
}
