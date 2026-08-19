// src/lib/ai-router.test.ts — intent routing must never classify a
// trading request (下單/買/賣...) as anything but 'trade_action', since
// that's the branch that refuses to act instead of calling a tool.

import { describe, expect, it } from 'vitest';
import { detectIntent } from './ai-router';

describe('detectIntent', () => {
    it('flags trading requests as trade_action, never a data intent', () => {
        expect(detectIntent('幫我買 100 股 2330').intent).toBe('trade_action');
        expect(detectIntent('賣出台積電').intent).toBe('trade_action');
        expect(detectIntent('help me buy 2330').intent).toBe('trade_action');
        expect(detectIntent('place an order for 2330').intent).toBe('trade_action');
    });

    it('routes position/balance/trade questions', () => {
        expect(detectIntent('我的持倉有哪些？').intent).toBe('positions');
        expect(detectIntent('帳戶餘額多少').intent).toBe('balance');
        expect(detectIntent('今天有哪些委託').intent).toBe('trades');
    });

    it('extracts a bare stock code for quote/kbar questions', () => {
        const { intent, symbolQuery } = detectIntent('2330 現在多少錢');
        expect(intent).toBe('quote');
        expect(symbolQuery).toBe('2330');
    });

    it('routes scanner/heatmap and watchlist/notes questions', () => {
        expect(detectIntent('今天漲幅排行').intent).toBe('scanner');
        expect(detectIntent('我的自選清單').intent).toBe('watchlists');
        expect(detectIntent('看一下我的研究筆記').intent).toBe('notes');
    });

    it('falls back to unknown for unrelated chit-chat', () => {
        expect(detectIntent('今天天氣如何').intent).toBe('unknown');
    });
});
