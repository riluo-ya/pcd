
import React from 'react';
import { Song } from '../types';

interface DifficultySelectorProps {
    difficulties: string[];
    selectedDifficulty: string | null;
    onSelectDifficulty: (difficulty: string) => void;
    selectedSong: Song | null;
    /** 需要提醒用户先选难度时，给整组加红色描边并抖动 */
    highlight?: boolean;
}

/** Phigros 玩家熟悉的难度配色：EZ绿 / HD蓝 / IN紫 / AT红 */
const DIFF_COLOR: Record<string, string> = {
    EZ: '#4ade80',
    HD: '#60a5fa',
    IN: '#c084fc',
    AT: '#f87171',
    SP: '#fbbf24',
};

const DIFF_ORDER = ['EZ', 'HD', 'IN', 'AT'];

export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
    difficulties,
    selectedDifficulty,
    onSelectDifficulty,
    selectedSong,
    highlight,
}) => {
    if (difficulties.length === 0) {
        return null;
    }

    // 始终显示四个标准槽位，缺失的难度置灰 —— 这样一眼能看出这首歌有没有 AT
    const slots = DIFF_ORDER;

    return (
        <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10px] font-medium tracking-[.14em] text-slate-500">
                可用难度
            </span>
            <div
                className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 ${highlight ? 'animate-shake' : ''}`}
                role="radiogroup"
                aria-label="难度"
            >
                {slots.map(diff => {
                    const available = difficulties.includes(diff);
                    const selected = available && diff === selectedDifficulty;
                    const color = DIFF_COLOR[diff] || '#94a3b8';
                    const key = diff as keyof Song['difficulties'];
                    const level = selectedSong?.difficulties?.[key];
                    const charter = selectedSong?.charters?.[diff as keyof Song['charters']];
                    const tooltip = charter ? `谱师：${charter}` : undefined;
                    return (
                        <button
                            key={diff}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={!available}
                            onClick={() => onSelectDifficulty(diff)}
                            title={tooltip}
                            className="px-4 py-3.5 rounded-[10px] border backdrop-blur-sm flex flex-wrap items-baseline justify-between transition-colors hover:bg-white/[.04] disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            style={{
                                borderColor: highlight
                                    ? '#f87171'
                                    : selected
                                      ? '#ffffff'
                                      : 'rgba(255,255,255,0.08)',
                                background: selected ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.015)',
                            }}
                        >
                            <span className="font-bold text-[15px] tracking-[.08em]" style={{ color }}>
                                {diff}
                            </span>
                            <span
                                className={`text-[26px] font-semibold leading-none ${selected ? 'text-white' : 'text-slate-500'}`}
                            >
                                {available ? (level ?? '?') : 'N/A'}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
