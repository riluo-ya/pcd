import React from 'react';
import { Song } from '../types';
import { SongFilter } from '../hooks/useSongFilter';
import { NameCombobox } from './NameCombobox';
import { XMarkIcon } from './Icons';
import { QuickFilters, emptyQuickFilters, DIFFS } from '../utils/bulkFilters';

interface SongFilterPanelProps {
    filter: SongFilter;
    songs: Song[];
    filteredCount: number;
    onClose?: () => void;
}

/**
 * 筛选面板的「内容」部分：桌面端放进下拉，手机端放进 BottomSheet，两边共用同一份。
 * 抽出来是为了避免两套布局各写一遍筛选逻辑，改一处即可。
 */
export const SongFilterPanel: React.FC<SongFilterPanelProps> = ({ filter, songs, filteredCount, onClose }) => {
    const { filters, setFilters, setFilter, toggleDiffFilter, charterOptions, composerOptions, activeFilterCount } = filter;

    return (
        <div className="w-full rounded-xl border border-white/[.08] bg-[rgba(12,15,22,.98)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">筛选</span>
                {activeFilterCount > 0 && (
                    <button
                        type="button"
                        onClick={() => setFilters(emptyQuickFilters)}
                        className="text-xs text-slate-400 hover:text-brand-cyan flex items-center gap-1"
                    >
                        <XMarkIcon className="w-3.5 h-3.5" />
                        清除
                    </button>
                )}
            </div>
{activeFilterCount > 0 && (
    <div className="flex items-center gap-2 px-3 py-2 bg-brand-cyan/5 border-b border-slate-700">
        <span className="text-[11px] text-slate-400 flex-shrink-0">筛选中</span>
        <div className="flex flex-wrap gap-1 flex-1">
            {filters.requireDiffs.length > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold">
                    含 {filters.requireDiffs.join('/')}
                </span>
            )}
            {(filters.levelMin || filters.levelMax) && (
                <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold">
                    定数 {filters.levelMin || '不限'} ~ {filters.levelMax || '不限'}
                </span>
            )}
            {filters.levels && (
                <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold">
                    定数 = {filters.levels}
                </span>
            )}
            {filters.charter && (
                <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold truncate max-w-[9rem]">
                    谱师 {filters.charter}
                </span>
            )}
            {filters.composer && (
                <span className="px-1.5 py-0.5 rounded bg-brand-cyan/15 text-brand-cyan text-[10px] font-semibold truncate max-w-[9rem]">
                    曲师 {filters.composer}
                </span>
            )}
        </div>
        <button
            type="button"
            onClick={() => setFilters(emptyQuickFilters)}
            className="text-slate-500 hover:text-slate-300 flex-shrink-0"
            aria-label="清除筛选"
        >
            <XMarkIcon className="w-3.5 h-3.5" />
        </button>
    </div>
)}

            <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* 难度 */}
                <div>
                    <div className="px-1 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        必须含难度
                    </div>
                    <div className="flex gap-1.5 mt-1">
                        {DIFFS.map(d => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => toggleDiffFilter(d)}
                                className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                                    filters.requireDiffs.includes(d)
                                        ? 'border-brand-cyan text-brand-cyan bg-brand-cyan/10'
                                        : 'border-slate-600 text-slate-400 hover:border-slate-500'
                                }`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 指定定数 */}
                <div>
                    <div className="px-1 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        指定定数
                    </div>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={filters.levels}
                        onChange={e => setFilter('levels', e.target.value)}
                        placeholder="如 17、17.6、15.3"
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                    />
                    <p className="text-[11px] text-slate-600 mt-1 px-1">
                        精确定数，可带小数也可不带；多个用逗号分隔，如 15.3, 17.6
                    </p>
                </div>

                {/* 定数区间 */}
                <div>
                    <div className="px-1 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        定数区间
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="number"
                            inputMode="decimal"
                            value={filters.levelMin}
                            onChange={e => setFilter('levelMin', e.target.value)}
                            placeholder="最低"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                        />
                        <span className="text-slate-600 text-xs flex-shrink-0">~</span>
                        <input
                            type="number"
                            inputMode="decimal"
                            value={filters.levelMax}
                            onChange={e => setFilter('levelMax', e.target.value)}
                            placeholder="最高"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                        />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 px-1">
                        任一难度落在区间内即命中；与「指定定数」同时填写时需两者都满足
                    </p>
                </div>

                {/* 谱师 */}
                <div>
                    <div className="flex items-center justify-between px-1 py-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            谱师
                        </span>
                        <span className="text-[10px] text-slate-600">
                            共 {charterOptions.length} 位
                        </span>
                    </div>
                    <div className="mt-1">
                        <NameCombobox
                            placeholder="输入或选择谱师"
                            options={charterOptions}
                            value={filters.charter}
                            onChange={v => setFilter('charter', v)}
                        />
                    </div>
                </div>

                {/* 曲师 */}
                <div>
                    <div className="flex items-center justify-between px-1 py-1">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            曲师
                        </span>
                        <span className="text-[10px] text-slate-600">
                            共 {composerOptions.length} 位
                        </span>
                    </div>
                    <div className="mt-1">
                        <NameCombobox
                            placeholder="输入或选择曲师"
                            options={composerOptions}
                            value={filters.composer}
                            onChange={v => setFilter('composer', v)}
                        />
                    </div>
                </div>
            </div>

            <div className="px-3 py-2 border-t border-slate-700 text-xs text-slate-500">
                命中 <span className="text-brand-cyan font-semibold">{filteredCount}</span> / {songs.length} 首
            </div>
        </div>
    );
};
