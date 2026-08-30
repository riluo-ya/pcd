
import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { defaultSettings } from '../defaultSettings';

interface SettingsPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ToggleSwitchProps {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, disabled }) => (
    <button
        type="button"
        disabled={disabled}
        className={`${
            enabled ? 'bg-brand-cyan' : 'bg-slate-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg hover:shadow-brand-cyan/10'} motion-switch relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-offset-2 focus:ring-offset-slate-900`}
        role="switch"
        aria-checked={enabled}
        onClick={() => !disabled && onChange(!enabled)}
    >
        <span
            aria-hidden="true"
            className={`${
                enabled ? 'translate-x-5' : 'translate-x-0'
            } ${disabled ? 'motion-switch-thumb-disabled' : ''} motion-switch-thumb pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white ring-0`}
        />
    </button>
);

export const SettingsPopup: React.FC<SettingsPopupProps> = ({ isOpen, onClose }) => {
    const { settings, setSettings } = useSettings();
    const [confirmReset, setConfirmReset] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setConfirmReset(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;
    
    const handleResetConfirm = () => {
        setSettings(defaultSettings);
        setConfirmReset(false);
    };

    const handleToggleZipFormat = () => {
        setSettings(prev => ({ ...prev, useZipFormat: !prev.useZipFormat }));
    };

    const handleToggleInfoYml = () => {
        setSettings(prev => ({ ...prev, includeInfoYml: !prev.includeInfoYml }));
    };

    const handleChangeExportIllustrationType = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSettings(prev => ({ ...prev, exportIllustrationType: e.target.value as 'full' | 'blur' }));
    };

    const handleToggleDiscordNotifications = () => {
        setSettings(prev => ({ ...prev, disableDiscordNotifications: !prev.disableDiscordNotifications }));
    };

    const handleToggleUseNewUi = () => {
        setSettings(prev => ({ ...prev, useNewUi: !prev.useNewUi }));
    };

    const handleToggleAudioPreview = () => {
        setSettings(prev => ({ ...prev, newUiAudioPreview: !prev.newUiAudioPreview }));
    };

    const handleChangeAudioVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, newUiAudioVolume: Number(e.target.value) }));
    };

    const handleToggleLoopAudio = () => {
        setSettings(prev => ({ ...prev, newUiLoopAudio: !prev.newUiLoopAudio }));
    };

    const handleToggleShowVisualizer = () => {
        setSettings(prev => ({ ...prev, newUiShowVisualizer: !prev.newUiShowVisualizer }));
    };

    const handleChangeVisualizerColor = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, newUiVisualizerColor: e.target.value }));
    };
    
    const handleChangeVisualizerHeight = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, newUiVisualizerHeight: Number(e.target.value) }));
    };

    const handleChangeVisualizerOpacity = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, newUiVisualizerOpacity: Number(e.target.value) }));
    };

    const handleToggleSongEffects = () => {
        setSettings(prev => ({ ...prev, newUiSongSpecificEffects: !prev.newUiSongSpecificEffects }));
    };

    const handleToggleAdvancedInfo = () => {
        setSettings(prev => ({ ...prev, advancedInfo: !prev.advancedInfo }));
    };

    const handleToggleBulkDownloadMode = () => {
        setSettings(prev => ({ ...prev, bulkDownloadMode: !prev.bulkDownloadMode }));
    };

    return (
        <div 
            className="motion-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            aria-labelledby="settings-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                className={`motion-dialog relative w-full max-w-md mx-auto overflow-hidden rounded-xl border border-slate-700 shadow-2xl p-6 text-left transform transition-all ${
                    settings.useNewUi ? 'bg-slate-900/80 backdrop-blur-md' : 'bg-slate-900'
                }`}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <h2 id="settings-title" className="text-2xl font-bold text-brand-cyan mb-6">
                    设置
                </h2>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {/* General Settings */}
                    <div className="flex items-center justify-between">
                        <div>
                             <p className="font-semibold text-slate-200">批量下载模式（开发中）</p>
                             <p className="text-sm text-slate-400">允许批量导出资源和谱面。</p>
                        </div>
                        <ToggleSwitch enabled={settings.bulkDownloadMode} onChange={handleToggleBulkDownloadMode} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                             <p className="font-semibold text-slate-200">使用 ZIP 格式</p>
                             <p className="text-sm text-slate-400">将谱面导出为「.zip」而非「.pez」。</p>
                        </div>
                        <ToggleSwitch enabled={settings.useZipFormat} onChange={handleToggleZipFormat} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                             <p className="font-semibold text-slate-200">包含「info.yml」</p>
                             <p className="text-sm text-slate-400">在谱面中添加「info.yml」以获得更好的 Phira 兼容性。</p>
                        </div>
                        <ToggleSwitch enabled={settings.includeInfoYml} onChange={handleToggleInfoYml} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                             <p className="font-semibold text-slate-200">导出图片类型</p>
                             <p className="text-sm text-slate-400">决定导出谱面时曲绘使用的质量。建议保持为「原始尺寸」。</p>
                        </div>
                        <select 
                            value={settings.exportIllustrationType} 
                            onChange={handleChangeExportIllustrationType}
                            className="bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-brand-cyan cursor-pointer"
                        >
                            <option value="full">原始尺寸</option>
                            <option value="blur">模糊</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                             <p className="font-semibold text-slate-200">禁用统计</p>
                             <p className="text-sm text-slate-400">禁用关于已下载谱面的匿名统计。<br />（注意：使用 Discord webhook。）</p>
                        </div>
                        <ToggleSwitch enabled={settings.disableDiscordNotifications} onChange={handleToggleDiscordNotifications} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                             <p className="font-semibold text-slate-200">高级信息</p>
                             <p className="text-sm text-slate-400">启用包含高级信息的提示框（如歌曲 ID、曲绘分辨率）。</p>
                        </div>
                        <ToggleSwitch enabled={settings.advancedInfo} onChange={handleToggleAdvancedInfo} />
                    </div>

                    <hr className="border-slate-700/50" />

                    {/* New UI Section (Now at the bottom) */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-slate-200">使用新界面</p>
                                <p className="text-sm text-slate-400">用户界面的全面改版。禁用此项可返回旧界面。</p>
                            </div>
                            <ToggleSwitch enabled={settings.useNewUi} onChange={handleToggleUseNewUi} />
                        </div>

                        {/* Sub-settings for New UI */}
                        <div className={`motion-settings-group space-y-4 pl-4 border-l-2 ml-1 ${!settings.useNewUi ? 'opacity-40 pointer-events-none translate-y-1 border-slate-700/30' : 'opacity-100 translate-y-0 border-brand-cyan/40'}`}>
                             <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">播放音频预览（开发中）</p>
                                    <p className="text-xs text-slate-500">选择歌曲后自动播放该歌曲的音频。选择歌曲时获取音频文件。</p>
                                </div>
                                <ToggleSwitch 
                                    enabled={settings.newUiAudioPreview} 
                                    onChange={handleToggleAudioPreview} 
                                    disabled={!settings.useNewUi}
                                />
                            </div>

                            <div className={`flex items-center justify-between transition-opacity duration-200 ${!settings.newUiAudioPreview ? 'opacity-50' : ''}`}>
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">音频音量</p>
                                    <p className="text-xs text-slate-500">设置音频播放器的音量。</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.05"
                                        value={settings.newUiAudioVolume} 
                                        onChange={handleChangeAudioVolume}
                                        disabled={!settings.useNewUi || !settings.newUiAudioPreview}
                                        className="w-24 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-cyan hover:accent-cyan-300 focus:outline-none disabled:opacity-50"
                                    />
                                    <span className="text-sm font-mono text-slate-400 w-9 text-right">{Math.round(settings.newUiAudioVolume * 100)}%</span>
                                </div>
                            </div>

                             <div className={`flex items-center justify-between transition-opacity duration-200 ${!settings.newUiAudioPreview ? 'opacity-50' : ''}`}>
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">循环播放音频</p>
                                    <p className="text-xs text-slate-500">自动重复播放歌曲。</p>
                                </div>
                                <ToggleSwitch 
                                    enabled={settings.newUiLoopAudio} 
                                    onChange={handleToggleLoopAudio} 
                                    disabled={!settings.useNewUi || !settings.newUiAudioPreview}
                                />
                            </div>

                            <div className={`flex items-center justify-between transition-opacity duration-200 ${!settings.newUiAudioPreview ? 'opacity-50' : ''}`}>
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">显示可视化效果</p>
                                    <p className="text-xs text-slate-500">显示音频可视化效果。</p>
                                </div>
                                <ToggleSwitch 
                                    enabled={settings.newUiShowVisualizer} 
                                    onChange={handleToggleShowVisualizer} 
                                    disabled={!settings.useNewUi || !settings.newUiAudioPreview}
                                />
                            </div>

                            <div className={`flex items-center justify-between transition-opacity duration-200 ${!settings.newUiShowVisualizer || !settings.newUiAudioPreview ? 'opacity-50' : ''}`}>
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">可视化颜色</p>
                                    <p className="text-xs text-slate-500">输入颜色代码、名称或十六进制值。或者点击选择颜色。</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative w-10 h-10 rounded-lg border border-slate-600 shadow-inner overflow-hidden shrink-0 transition-colors focus-within:ring-2 focus-within:ring-brand-cyan focus-within:ring-offset-2 focus-within:ring-offset-slate-900">
                                        <div 
                                            className="absolute inset-0 pointer-events-none" 
                                            style={{ backgroundColor: settings.newUiVisualizerColor }} 
                                        />
                                        <input 
                                            type="color" 
                                            value={
                                                /^#[0-9A-Fa-f]{6}$/.test(settings.newUiVisualizerColor) 
                                                ? settings.newUiVisualizerColor 
                                                : '#808080'
                                            }
                                            onChange={handleChangeVisualizerColor}
                                            disabled={!settings.useNewUi || !settings.newUiShowVisualizer || !settings.newUiAudioPreview}
                                            className="opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed" 
                                            aria-label="选择可视化颜色"
                                        />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={settings.newUiVisualizerColor} 
                                        onChange={handleChangeVisualizerColor}
                                        disabled={!settings.useNewUi || !settings.newUiShowVisualizer || !settings.newUiAudioPreview}
                                        className="bg-slate-800 border border-slate-600 text-slate-200 text-sm rounded px-3 py-2 w-28 focus:outline-none focus:border-brand-cyan disabled:opacity-50 disabled:cursor-not-allowed font-mono text-center uppercase"
                                        placeholder="#RRGGBB"
                                    />
                                </div>
                            </div>

                            <div className={`flex items-center justify-between transition-opacity duration-200 ${!settings.newUiShowVisualizer || !settings.newUiAudioPreview ? 'opacity-50' : ''}`}>
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">可视化高度</p>
                                    <p className="text-xs text-slate-500">更改可视化柱状图的最大高度。</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min="10" 
                                        max="100" 
                                        step="5"
                                        value={settings.newUiVisualizerHeight} 
                                        onChange={handleChangeVisualizerHeight}
                                        disabled={!settings.useNewUi || !settings.newUiShowVisualizer || !settings.newUiAudioPreview}
                                        className="w-24 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-cyan hover:accent-cyan-300 focus:outline-none disabled:opacity-50"
                                    />
                                    <span className="text-sm font-mono text-slate-400 w-8 text-right">{settings.newUiVisualizerHeight}%</span>
                                </div>
                            </div>

                            <div className={`flex items-center justify-between transition-opacity duration-200 ${!settings.newUiShowVisualizer || !settings.newUiAudioPreview ? 'opacity-50' : ''}`}>
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">可视化不透明度</p>
                                    <p className="text-xs text-slate-500">调整可视化柱状图的透明度。</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="range" 
                                        min="10" 
                                        max="100" 
                                        step="5"
                                        value={settings.newUiVisualizerOpacity} 
                                        onChange={handleChangeVisualizerOpacity}
                                        disabled={!settings.useNewUi || !settings.newUiShowVisualizer || !settings.newUiAudioPreview}
                                        className="w-24 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-brand-cyan hover:accent-cyan-300 focus:outline-none disabled:opacity-50"
                                    />
                                    <span className="text-sm font-mono text-slate-400 w-8 text-right">{settings.newUiVisualizerOpacity}%</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-300 text-sm">歌曲专属特效（开发中）</p>
                                    <p className="text-xs text-slate-500">选择✨特定✨歌曲时显示独特的「异常」特效。可能导致卡顿。<br/>（部分特效需要「音频预览」才能工作，因为它们与歌曲同步。）</p>
                                </div>
                                <ToggleSwitch 
                                    enabled={settings.newUiSongSpecificEffects} 
                                    onChange={handleToggleSongEffects} 
                                    disabled={!settings.useNewUi}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-4 min-h-[44px]">
                    {confirmReset ? (
                        <div className="flex items-center gap-3 animate-pulse">
                            <span className="text-slate-300 text-sm font-semibold mr-2">确定要重置吗？</span>
                            <button
                                onClick={handleResetConfirm}
                                className="px-4 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 bg-red-600 hover:bg-red-700 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                                是
                            </button>
                            <button
                                onClick={() => setConfirmReset(false)}
                                className="px-4 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 bg-slate-700 hover:bg-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500"
                            >
                                否
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => setConfirmReset(true)}
                                className="px-6 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 bg-red-900/40 hover:bg-red-800/60 text-red-200 border border-red-800/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-red-700"
                            >
                                重置默认值
                            </button>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 bg-slate-600 hover:bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500"
                            >
                                关闭
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
