import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Song } from '../types';
import {
    Filters,
    emptyFilters,
    DIFFS,
    DIFF_LABEL,
    FILES_PER_SONG,
    applyBaseFilters,
    applyStatsFilters,
    songLevels,
    blacklistedDiffs,
    countExportDiffs,
    DIFF_COLOR,
} from '../utils/bulkFilters';
import { ChartStats, scanChartStats } from '../utils/chartStats';
import { useSettings } from '../contexts/SettingsContext';
import { exportBulkAssets } from '../utils/export';
import type { FailedFile } from '../worker/export.worker';

// ================= 小组件 =================

const SectionTitle: React.FC<{ children: React.ReactNode; count?: number }> = ({ children, count }) => (
    <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-slate-200">{children}</span>
        {count !== undefined && <span className="text-xs text-slate-500">{count} 首</span>}
    </div>
);

const TextInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}> = ({ value, onChange, placeholder, disabled, className = '' }) => (
    <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan disabled:opacity-50 ${className}`}
    />
);

const NumInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
}> = ({ value, onChange, placeholder, disabled }) => (
    <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan disabled:opacity-50"
    />
);

const RangeRow: React.FC<{
    label: string;
    unit?: string;
    min: string;
    max: string;
    onMin: (v: string) => void;
    onMax: (v: string) => void;
    placeholderMin?: string;
    placeholderMax?: string;
    disabled?: boolean;
}> = ({ label, unit, min, max, onMin, onMax, placeholderMin = '不限', placeholderMax = '不限', disabled }) => (
    <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 w-16 flex-shrink-0">{label}</span>
        <NumInput value={min} onChange={onMin} placeholder={placeholderMin} disabled={disabled} />
        <span className="text-slate-600 text-xs">~</span>
        <NumInput value={max} onChange={onMax} placeholder={placeholderMax} disabled={disabled} />
        {unit && <span className="text-xs text-slate-500 w-8 flex-shrink-0">{unit}</span>}
    </div>
);

const ChipToggle: React.FC<{
    label: string;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
    color?: string;
}> = ({ label, active, onClick, disabled, color }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`px-2.5 py-1 text-xs rounded-md border transition-colors disabled:opacity-40 ${
            active
                ? 'border-brand-cyan text-brand-cyan bg-brand-cyan/10'
                : 'border-slate-600 text-slate-400 hover:border-slate-500'
        }`}
        style={active && color ? { borderColor: color, color, background: `${color}1a` } : undefined}
    >
        {label}
    </button>
);

// ================= 主组件 =================

export const BulkDownloadPanel: React.FC<BulkDownloadPanelProps> = ({ songs, isLoading, error, onExit }) => {
    // 打包谱面包时需要用到导出格式（.pez / .zip）与是否附带 info.yml
    const { settings } = useSettings();
    const [filters, setFilters] = useState<Filters>(emptyFilters);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [statsMap, setStatsMap] = useState<Map<string, ChartStats> | null>(null);
    const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
    const scanAbortRef = useRef<AbortController | null>(null);
    const scanSigRef = useRef<string>('');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    /** 导出难度范围：null/空 = 每首歌的全部难度 */
    const [exportDiffs, setExportDiffs] = useState<string[]>([]);
    /** 打包方式：每难度独立谱面包（默认）/ 原始资源平铺 */
    const [packaging, setPackaging] = useState<'per-difficulty' | 'raw'>('per-difficulty');
    const [batchSize, setBatchSize] = useState<string>('50');
    const [delay, setDelay] = useState<string>('0.6');

    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState<{
        currentFile: string;
        action: string;
        songsLeft: number;
        percent: number;
        batch: number;
        batches: number;
    } | null>(null);
    const [result, setResult] = useState<{ failed: FailedFile[]; cancelled: boolean } | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const listRef = useRef<HTMLDivElement>(null);

    const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
        setFilters(prev => ({ ...prev, [key]: value }));

    // 只依赖基础筛选的结果：谱面数据扫描针对这批做，避免解析用不上的曲子
    const baseFiltered = useMemo(() => applyBaseFilters(songs, filters), [songs, filters]);
    const finalSongs = useMemo(
        () => applyStatsFilters(baseFiltered, filters, statsMap),
        [baseFiltered, filters, statsMap]
    );

    // 需要解析谱面数据时自动扫描；基础筛选变了就重新扫
    const baseSig = useMemo(() => baseFiltered.map(s => s.id).join('|'), [baseFiltered]);
    useEffect(() => {
        if (!filters.useChartStats) {
            scanAbortRef.current?.abort();
            scanAbortRef.current = null;
            scanSigRef.current = '';
            setStatsMap(null);
            setScanProgress(null);
            return;
        }
        if (scanSigRef.current === baseSig) return;
        if (baseFiltered.length === 0) {
            setStatsMap(new Map());
            setScanProgress(null);
            return;
        }

        const ctrl = new AbortController();
        scanAbortRef.current = ctrl;
        scanSigRef.current = baseSig;
        setScanProgress({ done: 0, total: baseFiltered.length });

        scanChartStats(baseFiltered, {
            signal: ctrl.signal,
            onProgress: p => setScanProgress(p),
        })
            .then(map => {
                if (ctrl.signal.aborted) return;
                setStatsMap(map);
                setScanProgress(null);
            })
            .catch(() => {
                if (ctrl.signal.aborted) return;
                setScanProgress(null);
            });

        return () => {
            ctrl.abort();
        };
    }, [filters.useChartStats, baseSig, baseFiltered]);

    // 曲目被筛掉后，把不再可见的选中的也清掉，避免「看不见却会下载」
    useEffect(() => {
        setSelectedIds(prev => {
            const visible = new Set(finalSongs.map(s => s.id));
            const next = new Set([...prev].filter(id => visible.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [finalSongs]);

    const selectedSongs = useMemo(
        () => finalSongs.filter(s => selectedIds.has(s.id)),
        [finalSongs, selectedIds]
    );

    const rowVirtualizer = useVirtualizer({
        count: finalSongs.length,
        getScrollElement: () => listRef.current,
        estimateSize: () => 40,
        overscan: 8,
    });

    const toggleOne = (id: string) =>
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const selectAllVisible = () => setSelectedIds(new Set(finalSongs.map(s => s.id)));
    const clearSelection = () => setSelectedIds(new Set());

    // 预计：每首 8 个请求 + 歌曲间延迟
    const delaySec = Math.max(0, Number(delay) || 0);
    // 谱面请求数按「每首歌实际要下的难度数」算，而不是一律 4；
    // 非谱面资源则看打包方式：每难度独立包只需要 1 张曲绘 + 音频，平铺模式要全部 3 张曲绘
    const sharedPerSong = packaging === 'per-difficulty' ? 2 : (FILES_PER_SONG - 4);
    const estRequests = selectedSongs.reduce(
        (sum, s) => sum + sharedPerSong + countExportDiffs(s, exportDiffs),
        0
    );
    const estSeconds = Math.round(selectedSongs.length * (1.2 + delaySec));
    const estText = estSeconds >= 60
        ? `约 ${Math.floor(estSeconds / 60)} 分 ${estSeconds % 60} 秒`
        : `约 ${estSeconds} 秒`;

    const batches = useMemo(() => {
        const size = Math.max(0, parseInt(batchSize, 10) || 0);
        if (size <= 0 || selectedSongs.length <= size) {
            return selectedSongs.length ? [selectedSongs] : [];
        }
        const out: Song[][] = [];
        for (let i = 0; i < selectedSongs.length; i += size) {
            out.push(selectedSongs.slice(i, i + size));
        }
        return out;
    }, [selectedSongs, batchSize]);

    /** 把 worker 报的失败过滤掉「本来就不存在」的，只留真正该有的 */
    const meaningfulFailures = (failed: FailedFile[]): FailedFile[] =>
        failed.filter(f => {
            if (f.fileType === 'Audio') return true;
            const m = f.fileType.match(/^Chart \((\w+)\)$/);
            if (m) {
                const song = songs.find(s => s.id === f.songId);
                return !!song && levelOf(song, m[1]) !== null;
            }
            // 曲绘有三个候选尺寸，缺其中一两个是正常的
            return false;
        });

    const runExport = useCallback(async (targets: Song[][], isRetry: boolean) => {
        if (targets.length === 0) return;
        setRunning(true);
        setResult(null);
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const collected: FailedFile[] = [];

        try {
            for (let i = 0; i < targets.length; i++) {
                const chunk = targets[i];
                const name = targets.length > 1
                    ? `Phigros_All_Assets_${String(i + 1).padStart(2, '0')}-of-${String(targets.length).padStart(2, '0')}.zip`
                    : undefined;
                const failed = await exportBulkAssets(
                    chunk,
                    delaySec,
                    (currentFile, action, songsLeft, percent) =>
                        setProgress({
                            currentFile,
                            action,
                            songsLeft,
                            percent: percent || 0,
                            batch: i + 1,
                            batches: targets.length,
                        }),
                    ctrl.signal,
                    name,
                    exportDiffs.length > 0 ? exportDiffs : null,
                    packaging,
                    settings
                );
                collected.push(...failed);
            }
            setResult({ failed: meaningfulFailures(collected), cancelled: false });
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                setResult({ failed: [], cancelled: true });
            } else {
                console.error('[bulk] 导出失败', e);
                setResult({ failed: [], cancelled: false });
                window.alert('批量导出过程中发生错误，请查看控制台获取详情。');
            }
        } finally {
            setRunning(false);
            setProgress(null);
            abortRef.current = null;
            if (!isRetry) setResult(prev => prev);
        }
    }, [delaySec, songs]);

    const handleStart = () => {
        if (selectedSongs.length === 0) return;
        // 黑名单预检
        const risky = selectedSongs.filter(s => blacklistedDiffs(s).length > 0);
        if (risky.length > 0) {
            const preview = risky.slice(0, 5).map(s => `· ${s.name}`).join('\n');
            const more = risky.length > 5 ? `\n…等共 ${risky.length} 首` : '';
            const ok = window.confirm(
                `选中曲目中有 ${risky.length} 首包含已知会导致 Phira 无响应的谱面：\n\n${preview}${more}\n\n继续下载？建议回到筛选勾选「排除黑名单曲目」。`
            );
            if (!ok) return;
        }
        void runExport(batches, false);
    };

    const retryFailed = () => {
        const ids = new Set((result?.failed || []).map(f => f.songId));
        const retrySongs = songs.filter(s => ids.has(s.id));
        if (retrySongs.length === 0) return;
        void runExport([retrySongs], true);
    };

    const cancelExport = () => abortRef.current?.abort();

    const resetFilters = () => setFilters(emptyFilters);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-3 text-slate-400 h-32 w-full max-w-3xl mx-auto">
                正在加载曲库…
            </div>
        );
    }
    if (error) {
        return (
            <div className="w-full max-w-3xl mx-auto p-6 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                <p className="text-slate-300">曲库加载失败：{error}</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto bg-slate-800/50 rounded-xl border border-slate-700/50 animate-fade-in">
            {/* 头部 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
                <div>
                    <h2 className="text-lg font-bold text-slate-100">批量下载</h2>
                    <p className="text-xs text-slate-500 mt-0.5">先筛选，再勾选要打包的曲目</p>
                </div>
                <button
                    type="button"
                    onClick={onExit}
                    disabled={running}
                    className="px-3 py-1.5 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-40"
                >
                    退出批量模式
                </button>
            </div>

            <div className="px-5 py-4 space-y-5">
                {/* 基础筛选 */}
                <div>
                    <SectionTitle>筛选条件</SectionTitle>
                    <div className="space-y-3">
                        <TextInput
                            value={filters.keyword}
                            onChange={v => set('keyword', v)}
                            placeholder="关键词：曲名 / ID / 作曲家 / 谱师"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <TextInput
                                value={filters.composer}
                                onChange={v => set('composer', v)}
                                placeholder="作曲家包含…"
                            />
                            <TextInput
                                value={filters.charter}
                                onChange={v => set('charter', v)}
                                placeholder="谱师包含…"
                            />
                        </div>

                        {/* 定数 */}
                        <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-10 flex-shrink-0">指定值</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    value={filters.levels}
                                    onChange={e => set('levels', e.target.value)}
                                    placeholder="如 17、17.6、15.3"
                                    className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                                />
                            </div>
                            <RangeRow
                                label="定数"
                                min={filters.levelMin}
                                max={filters.levelMax}
                                onMin={v => set('levelMin', v)}
                                onMax={v => set('levelMax', v)}
                                placeholderMin="1.0"
                                placeholderMax="16.0"
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-400">作用于</span>
                                <ChipToggle
                                    label="任一难度"
                                    active={filters.levelScope === 'any'}
                                    onClick={() => set('levelScope', 'any')}
                                />
                                <ChipToggle
                                    label="最高难度"
                                    active={filters.levelScope === 'highest'}
                                    onClick={() => set('levelScope', 'highest')}
                                />
                                <ChipToggle
                                    label="指定难度"
                                    active={filters.levelScope === 'specific'}
                                    onClick={() => set('levelScope', 'specific')}
                                />
                                {filters.levelScope === 'specific' && (
                                    <span className="flex gap-1 ml-1">
                                        {DIFFS.map(d => (
                                            <ChipToggle
                                                key={d}
                                                label={DIFF_LABEL[d]}
                                                active={filters.levelDiffs.includes(d)}
                                                onClick={() =>
                                                    set('levelDiffs', filters.levelDiffs.includes(d)
                                                        ? filters.levelDiffs.filter(x => x !== d)
                                                        : [...filters.levelDiffs, d])
                                                }
                                            />
                                        ))}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-600">
                                精确定数，可带小数也可不带；多个用逗号分隔。「指定值」与区间同时填写时需两者都满足。
                            </p>
                        </div>

                        {/* 必须存在的难度 */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-400">必须含难度</span>
                            {DIFFS.map(d => (
                                <ChipToggle
                                    key={d}
                                    label={DIFF_LABEL[d]}
                                    active={filters.requireDiffs.includes(d)}
                                    onClick={() =>
                                        set('requireDiffs', filters.requireDiffs.includes(d)
                                            ? filters.requireDiffs.filter(x => x !== d)
                                            : [...filters.requireDiffs, d])
                                    }
                                />
                            ))}
                            <span className="text-xs text-slate-600">不选表示不限制</span>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={filters.excludeBlacklisted}
                                onChange={e => set('excludeBlacklisted', e.target.checked)}
                                className="w-3.5 h-3.5 accent-cyan-400"
                            />
                            <span className="text-xs text-slate-400">排除含黑名单谱面的曲目</span>
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={resetFilters}
                        className="mt-2 text-xs text-slate-500 hover:text-brand-cyan"
                    >
                        重置筛选
                    </button>
                </div>

                {/* 高级：谱面数据 */}
                <div className="rounded-lg border border-slate-700/50">
                    <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={filters.useChartStats}
                            onChange={e => set('useChartStats', e.target.checked)}
                            className="w-3.5 h-3.5 accent-cyan-400"
                        />
                        <span className="text-xs text-slate-300">按谱面数据筛选（BPM / 时长 / 物量 / 判定线）</span>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(v => !v)}
                            className="ml-auto text-xs text-slate-500 hover:text-brand-cyan"
                        >
                            {showAdvanced ? '收起' : '展开'}
                        </button>
                    </label>

                    {filters.useChartStats && (
                        <div className="px-3 pb-3">
                            {scanProgress ? (
                                <div className="text-xs text-brand-cyan py-1">
                                    正在解析谱面 {scanProgress.done}/{scanProgress.total}…
                                    <button
                                        type="button"
                                        onClick={() => scanAbortRef.current?.abort()}
                                        className="ml-2 text-slate-500 hover:text-slate-300"
                                    >
                                        取消
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 py-1">
                                    已解析 {statsMap?.size ?? 0} 首
                                    <button
                                        type="button"
                                        onClick={() => { scanSigRef.current = ''; setStatsMap(null); }}
                                        className="ml-2 hover:text-brand-cyan"
                                    >
                                        重新解析
                                    </button>
                                </div>
                            )}

                            {showAdvanced && (
                                <div className="mt-2 space-y-2">
                                    <RangeRow
                                        label="BPM" unit=""
                                        min={filters.bpmMin} max={filters.bpmMax}
                                        onMin={v => set('bpmMin', v)} onMax={v => set('bpmMax', v)}
                                        disabled={!!scanProgress}
                                    />
                                    <RangeRow
                                        label="时长" unit="秒"
                                        min={filters.durMin} max={filters.durMax}
                                        onMin={v => set('durMin', v)} onMax={v => set('durMax', v)}
                                        disabled={!!scanProgress}
                                    />
                                    <RangeRow
                                        label="物量" unit=""
                                        min={filters.notesMin} max={filters.notesMax}
                                        onMin={v => set('notesMin', v)} onMax={v => set('notesMax', v)}
                                        disabled={!!scanProgress}
                                    />
                                    <RangeRow
                                        label="判定线" unit="条"
                                        min={filters.linesMin} max={filters.linesMax}
                                        onMin={v => set('linesMin', v)} onMax={v => set('linesMax', v)}
                                        disabled={!!scanProgress}
                                    />
                                    <p className="text-[11px] text-slate-600">
                                        物量与判定线取该曲信息量最全的难度（AT &gt; IN &gt; HD &gt; EZ）。
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 结果列表 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-200">
                            曲目 <span className="text-slate-500 font-normal">({finalSongs.length})</span>
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={selectAllVisible}
                                disabled={finalSongs.length === 0 || running}
                                className="text-xs text-slate-400 hover:text-brand-cyan disabled:opacity-40"
                            >
                                全选筛选结果
                            </button>
                            <button
                                type="button"
                                onClick={clearSelection}
                                disabled={selectedIds.size === 0 || running}
                                className="text-xs text-slate-400 hover:text-brand-cyan disabled:opacity-40"
                            >
                                清空
                            </button>
                        </div>
                    </div>

                    <div
                        ref={listRef}
                        className="h-64 overflow-y-auto custom-scrollbar rounded-lg border border-slate-700/60 bg-slate-900/50"
                    >
                        {finalSongs.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-sm text-slate-500">
                                没有符合筛选条件的曲目
                            </div>
                        ) : (
                            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
                                {rowVirtualizer.getVirtualItems().map(item => {
                                    const song = finalSongs[item.index];
                                    const checked = selectedIds.has(song.id);
                                    const levels = songLevels(song);
                                    const top = levels.length
                                        ? Math.max(...levels.map(l => l.level))
                                        : null;
                                    const bad = blacklistedDiffs(song);
                                    return (
                                        <div
                                            key={song.id}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${item.start}px)`,
                                            }}
                                        >
                                            <label
                                                className={`flex items-center gap-2.5 px-3 h-10 cursor-pointer select-none ${
                                                    checked ? 'bg-brand-cyan/5' : ''
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleOne(song.id)}
                                                    disabled={running}
                                                    className="w-3.5 h-3.5 accent-cyan-400 flex-shrink-0"
                                                />
                                                <span className="text-sm text-slate-200 truncate flex-1">
                                                    {song.name}
                                                    {bad.length > 0 && (
                                                        <span className="ml-1.5 text-[10px] text-red-400">
                                                            含黑名单 {bad.join('/')}
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-[11px] text-slate-500 truncate w-20 text-right">
                                                    {song.composer}
                                                </span>
                                                {/* 把该曲全部难度都列出来，避免只看得到一个定数，
                                                    误以为导出时只会下载一个难度 */}
                                                <span className="flex items-center gap-1 flex-shrink-0">
                                                    {levels.length === 0 ? (
                                                        <span className="text-[10px] text-slate-600">—</span>
                                                    ) : (
                                                        levels.map(l => (
                                                            <span
                                                                key={l.diff}
                                                                className="px-1 py-0.5 rounded text-[10px] font-semibold leading-none"
                                                                style={{
                                                                    color: DIFF_COLOR[l.diff],
                                                                    background: `${DIFF_COLOR[l.diff]}22`,
                                                                }}
                                                                title={`${l.diff} ${l.level.toFixed(1)}`}
                                                            >
                                                                {l.diff}
                                                            </span>
                                                        ))
                                                    )}
                                                </span>
                                            </label>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* 导出难度 */}
                <div className="rounded-lg border border-slate-700/50 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-200">导出难度</span>
                        <span className="text-[11px] text-slate-500">
                            {exportDiffs.length === 0
                                ? '全部难度'
                                : `仅 ${exportDiffs.join(' / ')}`}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <ChipToggle
                            label="全部"
                            active={exportDiffs.length === 0}
                            onClick={() => setExportDiffs([])}
                        />
                        {DIFFS.map(d => (
                            <ChipToggle
                                key={d}
                                label={DIFF_LABEL[d]}
                                active={exportDiffs.includes(d)}
                                color={DIFF_COLOR[d]}
                                onClick={() =>
                                    setExportDiffs(prev =>
                                        prev.includes(d)
                                            ? prev.filter(x => x !== d)
                                            : [...prev, d]
                                    )
                                }
                            />
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5">
                        默认导出每首歌的全部难度；只想练某个难度时可单独指定，
                        不存在的难度会自动跳过。
                    </p>
                </div>

                {/* 打包方式 */}
                <div className="rounded-lg border border-slate-700/50 px-3 py-2.5">
                    <div className="text-sm font-semibold text-slate-200 mb-2">打包方式</div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <ChipToggle
                            label="每难度独立谱面包"
                            active={packaging === 'per-difficulty'}
                            onClick={() => setPackaging('per-difficulty')}
                        />
                        <ChipToggle
                            label="原始资源平铺"
                            active={packaging === 'raw'}
                            onClick={() => setPackaging('raw')}
                        />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5">
                        {packaging === 'per-difficulty'
                            ? '每个难度一个 .pez / .zip，解压后可直接导入 Phira。曲绘与音频会在每个难度的包里各存一份，体积较大。'
                            : '曲绘与音频各存一份，谱面 JSON 放在 charts/ 目录。体积最小，但需要自己组装后才能导入。'}
                    </p>
                </div>

                {/* 导出设置 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">每包曲目数（0 = 全部打成一个包）</label>
                        <NumInput value={batchSize} onChange={setBatchSize} placeholder="50" disabled={running} />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">歌曲间延迟（秒）</label>
                        <NumInput value={delay} onChange={setDelay} placeholder="0.6" disabled={running} />
                        <p className="text-[11px] text-slate-600 mt-1">
                            每首约 8 次请求；GitHub 非官方限流约 5000 次/小时，建议留 0.5 秒以上。
                        </p>
                    </div>
                </div>

                {/* 摘要 + 开始 */}
                <div className="rounded-lg bg-slate-900/40 border border-slate-700/50 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span>已选 <span className="text-brand-cyan font-semibold">{selectedSongs.length}</span> 首</span>
                        <span>{batches.length} 个压缩包</span>
                        <span>约 {estRequests} 次请求</span>
                        <span>{estText}</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={running || selectedSongs.length === 0}
                            className={`relative overflow-hidden flex-1 px-5 py-2.5 font-bold rounded-lg transition-colors flex items-center justify-center ${
                                running || selectedSongs.length === 0
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                    : 'bg-brand-cyan hover:bg-cyan-400 text-slate-900'
                            }`}
                        >
                            {running ? '处理中…' : `下载 ${selectedSongs.length} 首`}
                        </button>
                        {running && (
                            <button
                                type="button"
                                onClick={cancelExport}
                                className="px-4 py-2.5 font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white"
                            >
                                取消
                            </button>
                        )}
                    </div>

                    {progress && (
                        <div className="mt-3 text-left">
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-300">
                                    {progress.batches > 1 ? `第 ${progress.batch}/${progress.batches} 包 · ` : ''}
                                    {progress.action === 'Downloading' ? '下载中'
                                        : progress.action === 'Waiting' ? '等待中' : '压缩中'}
                                </span>
                                <span className="text-slate-500">剩余 {progress.songsLeft} 首</span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate" title={progress.currentFile}>
                                {progress.currentFile}
                            </div>
                            {progress.percent > 0 && (
                                <div className="mt-1.5 h-1 rounded bg-slate-700 overflow-hidden">
                                    <div
                                        className="h-full bg-brand-purple transition-all duration-150"
                                        style={{ width: `${progress.percent.toFixed(0)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 结果 */}
                {result && !running && (
                    <div className="rounded-lg border border-slate-700/50 px-4 py-3 text-sm">
                        {result.cancelled ? (
                            <p className="text-slate-400">已取消导出。</p>
                        ) : result.failed.length === 0 ? (
                            <p className="text-emerald-400">全部完成，没有缺失文件。</p>
                        ) : (
                            <div>
                                <p className="text-amber-400">
                                    有 {result.failed.length} 个文件没下载到（多为音频或应有谱面缺失）
                                </p>
                                <ul className="mt-1.5 max-h-28 overflow-y-auto custom-scrollbar text-[11px] text-slate-500 space-y-0.5">
                                    {result.failed.slice(0, 20).map((f, i) => (
                                        <li key={i} className="truncate">
                                            · {f.songName} — {f.fileType}
                                        </li>
                                    ))}
                                    {result.failed.length > 20 && <li>…等共 {result.failed.length} 项</li>}
                                </ul>
                                <button
                                    type="button"
                                    onClick={retryFailed}
                                    className="mt-2 px-3 py-1.5 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                                >
                                    仅重试失败的曲目
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
