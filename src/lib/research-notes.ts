// src/lib/research-notes.ts — freeform per-symbol research notes, saved
// only in this browser's localStorage. This is the "locally saved research"
// source the AI copilot reads from — a lightweight substitute for an actual
// notes app, kept intentionally simple (no sync, no server round-trip).

import { useSyncExternalStore } from 'react';

export interface ResearchNote {
    id: string;
    code: string; // '' = general note, not tied to a symbol
    title: string;
    body: string;
    ts: number;
}

const STORAGE_KEY = 'sj-pro-research-notes';

function load(): ResearchNote[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as ResearchNote[]) : [];
    } catch {
        return [];
    }
}

let notes = load();
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
        // storage unavailable — session only
    }
}

export function addResearchNote(input: {
    code?: string;
    title: string;
    body: string;
}): ResearchNote {
    const note: ResearchNote = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        code: (input.code ?? '').toUpperCase(),
        title: input.title.trim(),
        body: input.body.trim(),
        ts: Date.now(),
    };
    notes = [note, ...notes];
    persist();
    emit();
    return note;
}

export function deleteResearchNote(id: string) {
    notes = notes.filter((n) => n.id !== id);
    persist();
    emit();
}

// symbol filter matches either the exact code or a code prefix (e.g. a
// futures/option code that starts with the underlying's stock code)
export function listResearchNotes(symbol?: string): ResearchNote[] {
    if (!symbol) return notes;
    const code = symbol.toUpperCase();
    return notes.filter((n) => n.code === code || n.code.startsWith(code));
}

export function useResearchNotes(): ResearchNote[] {
    return useSyncExternalStore(
        (l) => {
            listeners.add(l);
            return () => listeners.delete(l);
        },
        () => notes,
    );
}
