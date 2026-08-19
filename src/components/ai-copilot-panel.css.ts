// src/components/ai-copilot-panel.css.ts

import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../theme.css';

export const wrap = style({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
});

export const banner = style({
    display: 'flex',
    alignItems: 'center',
    gap: vars.space.xs,
    padding: `4px ${vars.space.sm}`,
    fontSize: '0.64rem',
    color: vars.color.mutedForeground,
    borderBottom: `1px solid ${vars.color.border}`,
    flexShrink: 0,
});

export const toolbar = style({
    display: 'flex',
    alignItems: 'center',
    gap: vars.space.xs,
    padding: `4px ${vars.space.sm}`,
    borderBottom: `1px solid ${vars.color.border}`,
    flexShrink: 0,
});

export const engineBadge = style({
    fontFamily: vars.font.mono,
    fontSize: '0.62rem',
    color: vars.color.accent,
    background: vars.color.accentDim,
    borderRadius: '999px',
    padding: '2px 8px',
});

export const iconBtn = style({
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: vars.color.mutedForeground,
    background: 'transparent',
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: '4px',
    cursor: 'pointer',
    ':hover': { color: vars.color.foreground },
});

export const iconBtnTight = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: vars.color.mutedForeground,
    background: 'transparent',
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: '4px',
    cursor: 'pointer',
    ':hover': { color: vars.color.foreground },
});

export const notesList = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    maxHeight: '6rem',
    overflowY: 'auto',
    marginTop: '2px',
});

export const noteRow = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: vars.space.xs,
    padding: '2px 4px',
    borderRadius: vars.radius.sm,
    ':hover': { background: vars.color.inset },
});

export const noteMeta = style({
    fontSize: '0.66rem',
    color: vars.color.foreground,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
});

export const noteDelete = style({
    flexShrink: 0,
    display: 'flex',
    color: vars.color.mutedForeground,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    ':hover': { color: vars.color.danger },
});

export const settingsPane = style({
    display: 'flex',
    flexDirection: 'column',
    gap: vars.space.xs,
    padding: vars.space.sm,
    borderBottom: `1px solid ${vars.color.border}`,
    background: vars.color.panelRaised,
    flexShrink: 0,
});

export const settingsRow = style({
    display: 'flex',
    alignItems: 'center',
    gap: vars.space.xs,
    fontSize: '0.68rem',
    color: vars.color.mutedForeground,
});

const engineOptBase = style({
    fontFamily: vars.font.body,
    fontSize: '0.66rem',
    padding: '3px 10px',
    cursor: 'pointer',
    borderRadius: '999px',
    border: '1px solid',
});

export const engineOpt = styleVariants({
    on: [
        engineOptBase,
        {
            color: vars.color.accent,
            borderColor: vars.color.accent,
            background: vars.color.accentDim,
            fontWeight: 600,
        },
    ],
    off: [
        engineOptBase,
        {
            color: vars.color.mutedForeground,
            borderColor: vars.color.border,
            background: 'transparent',
        },
    ],
    disabled: [
        engineOptBase,
        {
            color: vars.color.mutedForeground,
            borderColor: vars.color.border,
            background: 'transparent',
            opacity: 0.4,
            cursor: 'not-allowed',
        },
    ],
});

export const cliInput = style({
    flex: 1,
    fontFamily: vars.font.mono,
    fontSize: '0.68rem',
    color: vars.color.foreground,
    background: vars.color.inset,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: '4px 8px',
    outline: 'none',
});

export const list = style({
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: vars.space.sm,
    padding: vars.space.sm,
});

export const bubbleRow = styleVariants({
    user: [{ display: 'flex', justifyContent: 'flex-end' }],
    assistant: [{ display: 'flex', justifyContent: 'flex-start' }],
});

const bubbleBase = style({
    maxWidth: '92%',
    borderRadius: vars.radius.md,
    padding: '6px 10px',
    fontSize: '0.74rem',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
});

export const bubble = styleVariants({
    user: [
        bubbleBase,
        { background: vars.color.accentDim, color: vars.color.foreground },
    ],
    assistant: [
        bubbleBase,
        { background: vars.color.panelRaised, color: vars.color.foreground },
    ],
    pending: [
        bubbleBase,
        {
            background: vars.color.panelRaised,
            color: vars.color.mutedForeground,
            fontStyle: 'italic',
        },
    ],
});

export const toolChips = style({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '4px',
});

export const toolChip = style({
    fontFamily: vars.font.mono,
    fontSize: '0.6rem',
    color: vars.color.mutedForeground,
    border: `1px solid ${vars.color.border}`,
    borderRadius: '999px',
    padding: '1px 7px',
});

export const composer = style({
    display: 'flex',
    alignItems: 'flex-end',
    gap: vars.space.xs,
    padding: vars.space.sm,
    borderTop: `1px solid ${vars.color.border}`,
    flexShrink: 0,
});

export const textarea = style({
    flex: 1,
    resize: 'none',
    minHeight: '2.2rem',
    maxHeight: '6rem',
    fontFamily: vars.font.body,
    fontSize: '0.76rem',
    color: vars.color.foreground,
    background: vars.color.inset,
    border: `1px solid ${vars.color.border}`,
    borderRadius: vars.radius.sm,
    padding: '6px 8px',
    outline: 'none',
});

export const sendBtn = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: vars.color.accent,
    background: vars.color.accentDim,
    border: `1px solid ${vars.color.accent}`,
    borderRadius: vars.radius.sm,
    padding: '7px 9px',
    cursor: 'pointer',
    ':disabled': { opacity: 0.4, cursor: 'not-allowed' },
});

export const suggestRow = style({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: `0 ${vars.space.sm} ${vars.space.sm}`,
    flexShrink: 0,
});

export const suggestChip = style({
    fontFamily: vars.font.body,
    fontSize: '0.66rem',
    color: vars.color.mutedForeground,
    background: 'transparent',
    border: `1px solid ${vars.color.border}`,
    borderRadius: '999px',
    padding: '3px 10px',
    cursor: 'pointer',
    ':hover': { color: vars.color.foreground, borderColor: vars.color.borderBright },
});
