import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { defaultSettings, Settings } from '../defaultSettings';
import { PROXY_SOURCES } from '../utils/resourceUrls';
import { DialogFrame, DialogHeader, Button } from './ui/Dialog';
import { ClearCacheButton, ClearCacheInfo } from './ClearCacheButton';

export type SettingsCategory = 'export' | 'visual' | 'proxy' | 'advanced';

interface SettingsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialCategory?: SettingsCategory;
}

const CATEGORIES: { id: SettingsCategory; label: string }[] = [
    { id: 'export', label: '导出' },
    { id: 'visual', label: '界面' },
    { id: 'proxy', label: '网络' },
    { id: 'advanced', label: '高级' },
];

const PROXY_TAGS: Record<string, string> = {
    github: '默认',
    jsdelivr: 'CDN',
    'jsdelivr-gcore': 'CDN',
    'ghproxy-net': '代理',
    'ghfast-top': '代理',
    'gh-proxy-com': '代理',
};

/** 频谱配色可选项 */
const VISUALIZER_COLORS: [string, string][] = [
    ['gray', '灰白'],
    ['cyan', '青色'],
    ['purple', '紫色'],
    ['rainbow', '彩虹'],
];

// --- Controls ---

const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }> = ({ enabled, onChange, disabled, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className="relative w-[42px] h-6 rounded-full transition-colors duration-200 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60"
        style={{ background: enabled ? '#22d3ee' : 'rgba(255,255,255,0.12)' }}
    >
        <span
            className="absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full transition-transform duration-200"
            style={{ background: enabled ? '#06141a' : '#cbd5e1', transform: `translateX(${enabled ? 18 : 0}px)` }}
        />
    </button>
);

function Segmented<T extends string | boolean>({ value, options, onChange, disabled }: {
    value: T;
    options: [T, string][];
    onChange: (v: T) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex p-[3px] gap-0.5 rounded-[9px] bg-white/[.04] border border-white/[.08]" role="radiogroup">
            {options.map(([v, label]) => {
                const selected = v === value;
                return (
                    <button
                        key={String(v)}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={disabled}
                        onClick={() => onChange(v)}
                        className={`px-3.5 py-[5px] max-md:py-[7px] rounded-md text-[13px] font-semibold transition-colors disabled:cursor-not-allowed ${
                            selected ? 'bg-[rgba(34,211,238,0.14)] text-[#22d3ee]' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

const Slider: React.FC<{
    value: number; min: number; max: number; step: number;
    format: (v: number) => string;
    onChange: (v: number) => void;
    disabled?: boolean;
    label: string;
}> = ({ value, min, max, step, format, onChange, disabled, label }) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const pct = ((value - min) / (max - min)) * 100;

    const setFromPointer = (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const next = Math.round((min + p * (max - min)) / step) * step;
        onChange(Number(next.toFixed(4)));
    };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, Number((value + step).toFixed(4))));
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(min, Number((value - step).toFixed(4))));
        else return;
        e.preventDefault();
    };

    return (
        <>
            <div
                ref={trackRef}
                role="slider"
                tabIndex={disabled ? -1 : 0}
                aria-label={label}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                aria-valuetext={format(value)}
                aria-disabled={disabled}
                onKeyDown={disabled ? undefined : handleKey}
                onPointerDown={disabled ? undefined : (e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setFromPointer(e.clientX);
                }}
                onPointerMove={disabled ? undefined : (e) => {
                    if (e.currentTarget.hasPointerCapture(e.pointerId)) setFromPointer(e.clientX);
                }}
                className={`relative w-[120px] max-md:w-[160px] h-5 max-md:h-7 flex items-center touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60 rounded ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <div className="w-full h-1 rounded-sm bg-white/[.12]" />
                <div className="absolute left-0 h-1 rounded-sm bg-[#22d3ee]" style={{ width: `${pct}%` }} />
                <div
                    className="absolute w-3.5 h-3.5 -ml-[7px] rounded-full bg-slate-100 shadow-[0_0_0_3px_rgba(34,211,238,.25)]"
                    style={{ left: `${pct}%` }}
                />
            </div>
            <span className="w-10 text-right font-mono text-xs font-medium text-slate-400">{format(value)}</span>
        </>
    );
};

interface RowProps {
    title: string;
    description: string;
    badge?: string;
    sub?: boolean;
    disabled?: boolean;
    first?: boolean;
    children: React.ReactNode;
}

const Row: React.FC<RowProps> = ({ title, description, badge, sub, disabled, first, children }) => (
    <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-7 py-4 transition-opacity duration-200 ${first ? '' : 'border-t border-white/[.06]'} ${disabled ? 'opacity-40' : ''}`}
    >
        <div className={`flex-1 min-w-0 flex flex-col gap-0.5 ${sub ? 'ml-1 pl-4 border-l-2 border-white/[.08]' : ''}`}>
            <span className="flex items-center gap-2 text-[15px] font-semibold text-slate-200">
                {title}
                {badge && (
                    <span className="font-mono text-[9px] font-semibold tracking-[.1em] text-[#fbbf24] px-1.5 py-0.5 rounded bg-[rgba(251,191,36,.1)]">{badge}</span>
                )}
            </span>
            <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">{description}</span>
        </div>
        <div className={`flex-none flex items-center gap-2.5 ${sub ? 'ml-[22px] sm:ml-0' : ''}`}>{children}</div>
    </div>
);

// --- Popup ---

export const SettingsPopup: React.FC<SettingsPopupProps> = ({ isOpen, onClose, initialCategory = 'export' }) => {
    const { settings, setSettings } = useSettings();
    const [confirmReset, setConfirmReset] = useState(false);
    const [category, setCategory] = useState<SettingsCategory>(initialCategory);

    useEffect(() => {
        if (!isOpen) {
            setConfirmReset(false);
        } else {
            setCategory(initialCategory);
        }
    }, [isOpen, initialCategory]);

    if (!isOpen) return null;

    const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const noConversion = settings.chartFormatConversion === 'none';
    const noAudio = !settings.newUiAudioPreview;

    const renderExport = () => (
        <>
            <Row first title="谱面包扩展名" description="导出谱面时使用的扩展名。部分浏览器会自行改写，可能出现 pez.zip 这样的情况。">
                <Segmented value={settings.useZipFormat} options={[[false, 'PEZ'], [true, 'ZIP']]} onChange={v => update('useZipFormat', v)} />
            </Row>
            <Row title="谱面包曲绘" description="打包进谱面包的曲绘尺寸。">
                <Segmented value={settings.exportIllustrationType} options={[['full', '原图'], ['blur', '模糊图']]} onChange={v => update('exportIllustrationType', v)} />
            </Row>
            <Row title="谱面格式转换" description="把谱面数据转成其他格式以适配其他编辑器。只作用于谱面包，不影响单个文件下载。">
                <Segmented value={settings.chartFormatConversion} options={[['none', '不转换'], ['rpe', '转 RPE']]} onChange={v => update('chartFormatConversion', v)} />
            </Row>
            <Row sub disabled={noConversion} title="缓动拟合" description="把切分事件重建成更大的缓动事件，可减小体积；用 RPE 编辑时建议开启。">
                <Toggle label="缓动拟合" enabled={settings.chartEasingFitting} onChange={v => update('chartEasingFitting', v)} disabled={noConversion} />
            </Row>
            <Row title="附带 info.yml" description="谱面包里额外写入 info.yml，个别社区服务端会读取它。">
                <Toggle label="附带 info.yml" enabled={settings.includeInfoYml} onChange={v => update('includeInfoYml', v)} />
            </Row>
        </>
    );

    const renderVisual = () => (
        <>
            <Row first title="音频预览" description="选中曲目后自动载入并播放其音频。">
                <Toggle label="音频预览" enabled={settings.newUiAudioPreview} onChange={v => update('newUiAudioPreview', v)} />
            </Row>
            <Row sub disabled={noAudio} title="自动播放" description="选中曲目即自动开始播放；关闭时播放器会停在暂停状态，等你点播放。">
                <Toggle label="自动播放" enabled={settings.newUiAutoplayAudio} onChange={v => update('newUiAutoplayAudio', v)} disabled={noAudio} />
            </Row>
            <Row sub disabled={noAudio} title="音量" description="音频播放器的音量。">
                <Slider label="音量" value={settings.newUiAudioVolume} min={0} max={1} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={v => update('newUiAudioVolume', v)} disabled={noAudio} />
            </Row>
            <Row sub disabled={noAudio} title="循环播放" description="播完自动从头再来。">
                <Toggle label="循环播放" enabled={settings.newUiLoopAudio} onChange={v => update('newUiLoopAudio', v)} disabled={noAudio} />
            </Row>
            <Row title="背景模糊" description="弹窗与玻璃面板背后的模糊效果。关闭后改用黑色遮罩，低配设备更流畅。">
                <Toggle label="背景模糊" enabled={settings.newUiBlur} onChange={v => update('newUiBlur', v)} />
            </Row>

            <Row title="频谱可视化" description="在背景上方绘制实时频谱条，需要开启音频预览。">
                <Toggle label="频谱可视化" enabled={settings.newUiShowVisualizer} onChange={v => update('newUiShowVisualizer', v)} />
            </Row>
            <Row sub disabled={!settings.newUiShowVisualizer} title="频谱配色" description="频谱条的颜色方案。">
                <Segmented value={settings.newUiVisualizerColor} options={VISUALIZER_COLORS} onChange={v => update('newUiVisualizerColor', v)} disabled={!settings.newUiShowVisualizer} />
            </Row>
            <Row sub disabled={!settings.newUiShowVisualizer} title="频谱高度" description="频谱条的最大高度。">
                <Slider label="频谱高度" value={settings.newUiVisualizerHeight} min={20} max={100} step={1} format={v => `${v}%`} onChange={v => update('newUiVisualizerHeight', v)} disabled={!settings.newUiShowVisualizer} />
            </Row>
            <Row sub disabled={!settings.newUiShowVisualizer} title="频谱不透明度" description="频谱条的透明度，数值越大越明显。">
                <Slider label="频谱不透明度" value={settings.newUiVisualizerOpacity} min={10} max={100} step={1} format={v => `${v}%`} onChange={v => update('newUiVisualizerOpacity', v)} disabled={!settings.newUiShowVisualizer} />
            </Row>

            <Row title="曲目专属特效" description="部分曲目带有专门的画面特效（如故障、碎裂、烟花等）。特效较耗性能，卡顿时可关闭。">
                <Toggle label="曲目专属特效" enabled={settings.newUiSongSpecificEffects} onChange={v => update('newUiSongSpecificEffects', v)} />
            </Row>
        </>
    );

    const renderProxy = () => (
        <>
            <div className="pt-4 flex flex-col gap-1">
                <span className="text-[15px] font-semibold text-slate-200">加速源</span>
                <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">
                    加速源用于改善 GitHub 资源在国内的访问速度，也可能帮助规避速率限制。能直连时优先用 GitHub 官方。
                </span>
            </div>
            <div className="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="加速源">
                {PROXY_SOURCES.map(option => {
                    const selected = settings.proxySource === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => update('proxySource', option.id)}
                            className={`text-left flex items-center gap-3.5 px-3.5 py-3 rounded-[10px] border transition-colors ${
                                selected
                                    ? 'border-[rgba(34,211,238,0.5)] bg-[rgba(34,211,238,0.06)]'
                                    : 'border-white/[.07] bg-white/[.015] hover:border-white/[.18]'
                            }`}
                        >
                            <span className={`w-4 h-4 flex-none rounded-full border-[1.5px] flex items-center justify-center ${selected ? 'border-[#22d3ee]' : 'border-slate-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${selected ? 'bg-[#22d3ee]' : ''}`} />
                            </span>
                            <span className="flex-1 min-w-0 flex flex-col">
                                <span className="text-sm font-semibold text-slate-200">{option.label}</span>
                                <span className="text-xs text-slate-400">{option.description}</span>
                            </span>
                            <span className={`font-mono text-[10px] font-medium ${selected ? 'text-[#22d3ee]' : 'text-slate-600'}`}>{PROXY_TAGS[option.id]}</span>
                        </button>
                    );
                })}
            </div>
            <div className="mt-7 pt-5 border-t border-white/[.06] flex flex-col gap-1">
                <span className="text-[15px] font-semibold text-slate-200">GitHub 访问令牌</span>
                <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">
                    可选的 personal access token，用于提高 GitHub 速率上限，无需任何权限范围。它只存在这台浏览器里，且仅在加速源为 GitHub 时才会发送给 GitHub。
                </span>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <input
                    type="password"
                    value={settings.githubToken}
                    onChange={e => update('githubToken', e.target.value.trim())}
                    placeholder="ghp_… 或 github_pat_…"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="GitHub 个人访问令牌"
                    className="flex-1 min-w-0 h-[38px] max-md:h-11 px-3 rounded-lg bg-white/[.04] border border-white/[.08] font-mono text-xs max-md:text-base text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#22d3ee]/50"
                />
                <Button variant="outline" className="py-[7px] max-md:h-11" onClick={() => update('githubToken', '')} disabled={!settings.githubToken}>清除</Button>
            </div>
        </>
    );

    const renderAdvanced = () => (
        <>
            <Row first title="高级信息" description="悬浮提示里显示谱师、文件地址等进阶信息。">
                <Toggle label="高级信息" enabled={settings.advancedInfo} onChange={v => update('advancedInfo', v)} />
            </Row>
            <Row title="统计上报" description="匿名上报被下载谱面的统计信息；关闭后只发送一个匿名 ID。通过 Discord webhook 发送。">
                <Toggle label="统计上报" enabled={settings.analyticsEnabled} onChange={v => update('analyticsEnabled', v)} />
            </Row>
            <Row badge="WIP" title="批量下载模式" description="进入批量下载面板，可按定数、物量、BPM 等条件筛选后批量打包导出。">
                <Toggle label="批量下载模式" enabled={settings.bulkDownloadMode} onChange={v => update('bulkDownloadMode', v)} />
            </Row>

            <div className="mt-6 pt-5 border-t border-white/[.06] flex flex-col gap-1">
                <span className="text-[15px] font-semibold text-slate-200">分享卡片</span>
                <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">
                    选中曲目后可生成一张含曲绘、定数、谱师与二维码的图片。下面几项决定卡片上要显示哪些谱面数据，全部关闭时卡片生成更快。
                </span>
            </div>
            <Row first title="启用分享卡片" description="在曲目页面显示「生成分享卡片」入口。">
                <Toggle label="启用分享卡片" enabled={settings.shareCardEnabled} onChange={v => update('shareCardEnabled', v)} />
            </Row>
            <Row sub disabled={!settings.shareCardEnabled} title="显示 BPM" description="卡片上显示曲目 BPM。">
                <Toggle label="显示 BPM" enabled={settings.shareCardBpm} onChange={v => update('shareCardBpm', v)} disabled={!settings.shareCardEnabled} />
            </Row>
            <Row sub disabled={!settings.shareCardEnabled} title="显示判定线数" description="卡片上显示判定线数量。">
                <Toggle label="显示判定线数" enabled={settings.shareCardJudgeLines} onChange={v => update('shareCardJudgeLines', v)} disabled={!settings.shareCardEnabled} />
            </Row>
            <Row sub disabled={!settings.shareCardEnabled} title="显示时长" description="卡片上显示曲目时长。">
                <Toggle label="显示时长" enabled={settings.shareCardDuration} onChange={v => update('shareCardDuration', v)} disabled={!settings.shareCardEnabled} />
            </Row>
            <Row sub disabled={!settings.shareCardEnabled} title="显示各难度物量" description="卡片上显示每个难度的物量；需要额外下载各难度谱面解析。">
                <Toggle label="显示各难度物量" enabled={settings.shareCardNoteCounts} onChange={v => update('shareCardNoteCounts', v)} disabled={!settings.shareCardEnabled} />
            </Row>

            <div className="mt-6 pt-5 border-t border-white/[.06] flex flex-col gap-1">
                <span className="text-[15px] font-semibold text-slate-200">清除缓存</span>
                <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">
                    站点数据走 CDN，上游更新后你可能仍看到旧内容。清除缓存会强制回源取最新数据，并自动刷新页面。
                </span>
            </div>
            <div className="mt-3 flex flex-col gap-3">
                <ClearCacheInfo />
                <div className="flex">
                    <ClearCacheButton />
                </div>
            </div>
        </>
    );

    return (
        <DialogFrame onClose={onClose} labelledBy="settings-title" className="w-full max-w-[820px] h-[min(600px,calc(100dvh-32px))]">
            <DialogHeader id="settings-title" eyebrow="偏好设置" title="设置" onClose={onClose} />

            <div className="flex-1 min-h-0 flex flex-col sm:grid sm:grid-cols-[184px_minmax(0,1fr)]">
                <nav
                    className="flex sm:flex-col gap-0.5 px-3 py-2 sm:py-4 border-b sm:border-b-0 sm:border-r border-white/[.06] overflow-x-auto"
                    role="tablist"
                    aria-label="设置分类"
                >
                    {CATEGORIES.map(({ id, label }, i) => {
                        const selected = category === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                onClick={() => setCategory(id)}
                                className={`flex-none flex items-center justify-between gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                                    selected ? 'bg-[rgba(34,211,238,0.08)] text-[#22d3ee]' : 'text-slate-400 hover:text-slate-100'
                                }`}
                            >
                                <span>{label}</span>
                                <span className="font-mono text-[10px] font-medium text-slate-600">{String(i + 1).padStart(2, '0')}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-5 sm:px-7 pt-1 pb-5" role="tabpanel">
                    {category === 'export' && renderExport()}
                    {category === 'visual' && renderVisual()}
                    {category === 'proxy' && renderProxy()}
                    {category === 'advanced' && renderAdvanced()}
                </div>
            </div>

            <div className="flex-none min-h-[68px] flex flex-wrap items-center justify-between gap-3 px-6 py-3 max-md:px-5 max-md:pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-white/[.06] bg-white/[.015]">
                {confirmReset ? (
                    <div className="flex items-center gap-2.5">
                        <span className="text-[13px] text-[#fca5a5]">确定要重置全部设置吗？</span>
                        <Button variant="danger" className="py-[7px]" onClick={() => { setSettings(defaultSettings); setConfirmReset(false); }}>重置</Button>
                        <Button variant="outline" className="py-[7px]" onClick={() => setConfirmReset(false)}>取消</Button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setConfirmReset(true)}
                        className="flex items-center gap-2 text-[13px] font-semibold text-[#f87171] px-3 py-2 -ml-3 rounded-lg hover:bg-[rgba(248,113,113,.08)] transition-colors"
                    >
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        恢复默认设置
                    </button>
                )}
                <div className="flex items-center gap-4">
                    <span className="hidden sm:inline font-mono text-[10px] font-medium tracking-[.1em] text-slate-600">自动保存并立即生效</span>
                    <Button variant="primary" size="md" onClick={onClose}>完成</Button>
                </div>
            </div>
        </DialogFrame>
    );
};
