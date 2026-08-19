// src/lib/research-notes.test.ts

import { beforeEach, describe, expect, it } from 'vitest';

if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
    };
}

import {
    addResearchNote,
    deleteResearchNote,
    listResearchNotes,
} from './research-notes';

describe('research notes', () => {
    beforeEach(() => {
        localStorage.clear();
        for (const n of listResearchNotes()) deleteResearchNote(n.id);
    });

    it('adds and lists notes, newest first', () => {
        addResearchNote({ code: '2330', title: 'A', body: 'first' });
        addResearchNote({ code: '2330', title: 'B', body: 'second' });
        const notes = listResearchNotes();
        expect(notes.map((n) => n.title)).toEqual(['B', 'A']);
    });

    it('filters by exact code or code prefix', () => {
        addResearchNote({ code: '2330', title: 'TSMC', body: '' });
        addResearchNote({ code: '2317', title: 'Foxconn', body: '' });
        expect(listResearchNotes('2330').map((n) => n.title)).toEqual(['TSMC']);
        expect(listResearchNotes('9999')).toEqual([]);
    });

    it('deletes a note by id', () => {
        const note = addResearchNote({ code: '', title: 'general', body: '' });
        deleteResearchNote(note.id);
        expect(listResearchNotes()).toEqual([]);
    });
});
