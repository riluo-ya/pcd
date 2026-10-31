import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { defaultSettings, Settings } from '../defaultSettings';
import { DialogFrame, DialogHeader, Button } from './ui/Dialog';
import { ClearCacheButton } from './ClearCacheButton';

export type SettingsCategory = 'export' | 'visual' | 'network' | 'advanced';

interface SettingsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialCategory?: SettingsCategory;
    /** 打开加速源弹窗（PCD 自研功能，上游没有对应设置项） */
    onOpenSource?: () => void;
}

const CATEGORIES: { id: SettingsCategory; label: string }[] = [
    { id: 'export', label: '导出' },
    { id: 'visual', label: '界面' },
    { id: 'network', label: '网络' },
    { id: 'advanced', label: '高级' },
];

// --- 控件：样式对齐上游 ---

const Toggle: React.FC<{ enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }> = ({ enabled, onChange, disabled, label }) => (
    <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!enabled)}
        className="motion-switch relative w-[42px] h-6 rounded-full transition-colors duration-200 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee]/60"
        style={{ background: enabled ? '#22d3ee' : 'rgba(255,255,255,0.12)' }}
    >
        <span
            className={`motion-switch-thumb${disabled ? ' motion-switch-thumb-disabled' : ''} absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full`}
            style={{ background: enabled ? '#06141a' : '#cbd5e1', transform: `translateX(${enabled ? 18 : 0}px)` }}
        />
    </button>
);

function Segmented<T extends string | boolean>({ value, options, onChange, disabled, label }: {
    value: T;
    options: [T, string][];
    onChange: (v: T) => void;
    disabled?: boolean;
    label: string;
}) {
    return (
        <div className="flex p-[3px] gap-0.5 rounded-[9px] bg-white/[.04] border border-white/[.08]" role="radiogroup" aria-label={label}>
            {options.map(([v, text]) => {
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
                        {text}
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
    description: React.ReactNode;
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

export const SettingsPopup: React.FC<SettingsPopupProps> = ({ isOpen, onClose, initialCategory = 'export', onOpenSource }) => {
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

    // 界面类子项：关掉总开关后，子项一并置灰
    const noUi = !settings.useNewUi;
    const noAudio = noUi || !settings.newUiAudioPreview;
    const noVisualizer = noAudio || !settings.newUiShowVisualizer;
    const noShareCard = !settings.shareCardEnabled;

    const renderExport = () => (
        <>
            <Row first title="谱面扩展名" description="导出谱面时使用的扩展名。部分浏览器可能会改写，出现 pez.zip 之类的结果。">
                <Segmented label="谱面扩展名" value={settings.useZipFormat} options={[[false, 'PEZ'], [true, 'ZIP']]} onChange={v => update('useZipFormat', v)} />
            </Row>
            <Row title="谱面曲绘" description="打进导出谱面里的曲绘类型。建议保持「原始尺寸」。">
                <Segmented label="谱面曲绘" value={settings.exportIllustrationType} options={[['full', '原始尺寸'], ['blur', '模糊']]} onChange={v => update('exportIllustrationType', v)} />
            </Row>
            <Row title="包含「info.yml」" description="在谱面中加入「info.yml」，以获得更好的 Phira 兼容性。">
                <Toggle label="包含 info.yml" enabled={settings.includeInfoYml} onChange={v => update('includeInfoYml', v)} />
            </Row>
            <Row title="分享卡片" description="选中歌曲后显示「生成分享卡片」按钮。">
                <Toggle label="分享卡片" enabled={settings.shareCardEnabled} onChange={v => update('shareCardEnabled', v)} />
            </Row>
            {/* 分组标题：上游没有这种「只有说明、没有控件」的行，这里去掉控件位，
                让说明独占一行，避免右侧留一个空槽 */}
            <div className={`py-4 border-t border-white/[.06] transition-opacity duration-200 ${noShareCard ? 'opacity-40' : ''}`}>
                <div className="ml-1 pl-4 border-l-2 border-white/[.08] flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold text-slate-200">卡片内的谱面数据</span>
                    <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">
                        这些需要下载谱面文件解析，全部关闭时卡片会立即生成，无需等待。
                    </span>
                </div>
            </div>
            <Row sub disabled={noShareCard} title="BPM" description="曲名下方显示速度标记。">
                <Toggle label="BPM" enabled={settings.shareCardBpm} onChange={v => update('shareCardBpm', v)} disabled={noShareCard} />
            </Row>
            <Row sub disabled={noShareCard} title="判定线数" description="显示谱面用到的判定线数量。">
                <Toggle label="判定线数" enabled={settings.shareCardJudgeLines} onChange={v => update('shareCardJudgeLines', v)} disabled={noShareCard} />
            </Row>
            <Row sub disabled={noShareCard} title="时长" description="按谱面拍数与 BPM 换算的曲目长度。">
                <Toggle label="时长" enabled={settings.shareCardDuration} onChange={v => update('shareCardDuration', v)} disabled={noShareCard} />
            </Row>
            <Row sub disabled={noShareCard} title="各难度物量" description="每个难度后面显示 Notes 物量。">
                <Toggle label="各难度物量" enabled={settings.shareCardNoteCounts} onChange={v => update('shareCardNoteCounts', v)} disabled={noShareCard} />
            </Row>
        </>
    );

    const renderVisual = () => (
        <>
            <Row first title="使用新界面" description="用户界面的全面改版。关闭后回到旧界面。">
                <Toggle label="使用新界面" enabled={settings.useNewUi} onChange={v => update('useNewUi', v)} />
            </Row>
            <Row sub disabled={noUi} title="音频预览（开发中）" description="选择歌曲后自动播放该歌曲的音频。">
                <Toggle label="音频预览" enabled={settings.newUiAudioPreview} onChange={v => update('newUiAudioPreview', v)} disabled={noUi} />
            </Row>
            <Row sub disabled={noAudio} title="音量" description="音频播放器的音量。">
                <Slider label="音量" value={settings.newUiAudioVolume} min={0} max={1} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={v => update('newUiAudioVolume', v)} disabled={noAudio} />
            </Row>
            <Row sub disabled={noAudio} title="循环播放" description="歌曲结束后自动从头再放。">
                <Toggle label="循环播放" enabled={settings.newUiLoopAudio} onChange={v => update('newUiLoopAudio', v)} disabled={noAudio} />
            </Row>
            <Row sub disabled={noAudio} title="显示可视化效果" description="显示音频可视化效果。">
                <Toggle label="显示可视化效果" enabled={settings.newUiShowVisualizer} onChange={v => update('newUiShowVisualizer', v)} disabled={noAudio} />
            </Row>
            <Row sub disabled={noVisualizer} title="可视化颜色" description="点击选择颜色，也可直接输入颜色代码。">
                <div className="relative w-10 h-10 rounded-lg border border-white/[.08] shadow-inner overflow-hidden shrink-0">
                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: settings.newUiVisualizerColor }} />
                    <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(settings.newUiVisualizerColor) ? settings.newUiVisualizerColor : '#808080'}
                        onChange={e => update('newUiVisualizerColor', e.target.value)}
                        disabled={noVisualizer}
                        aria-label="可视化颜色"
                        className="opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                    />
                </div>
            </Row>
            <Row sub disabled={noVisualizer} title="可视化高度" description="可视化条形的高度。">
                <Slider label="可视化高度" value={settings.newUiVisualizerHeight} min={0} max={100} step={1} format={v => `${Math.round(v)}%`} onChange={v => update('newUiVisualizerHeight', v)} disabled={noVisualizer} />
            </Row>
            <Row sub disabled={noVisualizer} title="可视化不透明度" description="可视化效果的不透明度。">
                <Slider label="可视化不透明度" value={settings.newUiVisualizerOpacity} min={0} max={100} step={1} format={v => `${Math.round(v)}%`} onChange={v => update('newUiVisualizerOpacity', v)} disabled={noVisualizer} />
            </Row>
            <Row sub disabled={noUi} title="歌曲专属特效" description="为部分歌曲显示专属的画面特效。">
                <Toggle label="歌曲专属特效" enabled={settings.newUiSongSpecificEffects} onChange={v => update('newUiSongSpecificEffects', v)} disabled={noUi} />
            </Row>
        </>
    );

    const renderNetwork = () => (
        <>
            <div className="pt-4 flex flex-col gap-1">
                <span className="text-[15px] font-semibold text-slate-200">加速源</span>
                <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">
                    切换拉取谱面与曲绘时使用的线路。访问不畅时换一条，通常能解决问题。
                </span>
            </div>
            <div className="mt-3">
                <Button variant="outline" onClick={() => onOpenSource && onOpenSource()} disabled={!onOpenSource}>
                    选择加速源
                </Button>
            </div>
            <div className="mt-7 pt-5 border-t border-white/[.06] flex flex-col gap-1">
                <span className="text-[15px] font-semibold text-slate-200">清除缓存</span>
                <span className="text-[13px] leading-[1.5] text-slate-400 text-pretty">
                    清理本站缓存并刷新页面。界面显示异常或改动没生效时用一次。
                </span>
            </div>
            <div className="mt-3">
                <ClearCacheButton needConfirm bustCdn />
            </div>
        </>
    );

    const renderAdvanced = () => (
        <>
            <Row first badge="WIP" title="批量下载模式" description="允许批量导出资源和谱面。">
                <Toggle label="批量下载模式" enabled={settings.bulkDownloadMode} onChange={v => update('bulkDownloadMode', v)} />
            </Row>
            <Row title="高级信息" description="启用包含高级信息的提示框（如谱师、文件地址）。">
                <Toggle label="高级信息" enabled={settings.advancedInfo} onChange={v => update('advancedInfo', v)} />
            </Row>
            <Row title="统计" description="发送关于已下载谱面的匿名统计。关闭后仍会发送一个匿名 ID。（注意：使用 Discord webhook。）">
                <Toggle label="统计" enabled={!settings.disableDiscordNotifications} onChange={v => update('disableDiscordNotifications', !v)} />
            </Row>
        </>
    );

    return (
        <DialogFrame
            onClose={onClose}
            labelledBy="settings-title"
            className="w-full max-w-[820px] h-[min(600px,calc(100dvh-32px))]"
        >
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
                    {category === 'network' && renderNetwork()}
                    {category === 'advanced' && renderAdvanced()}
                </div>
            </div>

            <div className="flex-none min-h-[68px] flex flex-wrap items-center justify-between gap-3 px-6 py-3 max-md:px-5 max-md:pb-[calc(16px+env(safe-area-inset-bottom))] border-t border-white/[.06] bg-white/[.015]">
                {confirmReset ? (
                    <div className="flex items-center gap-2.5">
                        <span className="text-[13px] text-[#fca5a5]">重置全部设置？</span>
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
                        恢复默认
                    </button>
                )}
                <div className="flex items-center gap-4">
                    <span className="hidden sm:inline font-mono text-[10px] font-medium tracking-[.1em] text-slate-600">自动保存并生效</span>
                    <Button variant="primary" size="md" onClick={onClose}>完成</Button>
                </div>
            </div>
        </DialogFrame>
    );
};
