import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { PROXY_SOURCES } from '../utils/resourceUrls';
import { bumpCacheEpoch } from '../utils/resourceUrls';
import { DialogFrame, DialogHeader, DialogFooter, Button } from './ui/Dialog';

interface SourcePopupProps {
    isOpen: boolean;
    onClose: () => void;
}

const PROXY_TAGS: Record<string, string> = {
    github: '默认',
    jsdelivr: 'CDN',
    'jsdelivr-gcore': 'CDN',
    'ghproxy-net': '代理',
    'ghfast-top': '代理',
    'gh-proxy-com': '代理',
};

/**
 * 加速源快速切换弹窗。
 *
 * 与「设置 → 网络」里的选项共用同一个 settings.proxySource，
 * 切换后由 App 的数据加载副作用自动重新拉取，不需要刷新页面。
 * 顺带 bump CDN 版本号，保证切过去立刻拿到的是最新数据而不是 CDN 旧缓存。
 */
export const SourcePopup: React.FC<SourcePopupProps> = ({ isOpen, onClose }) => {
    const { settings, setSettings } = useSettings();

    if (!isOpen) return null;

    const handleSwitch = (id: typeof settings.proxySource) => {
        if (id === settings.proxySource) return;
        bumpCacheEpoch();
        setSettings(prev => ({ ...prev, proxySource: id }));
    };

    return (
        <DialogFrame onClose={onClose} labelledBy="source-title" className="w-full max-w-[520px] max-h-[min(80dvh,680px)]">
            <DialogHeader id="source-title" eyebrow="Network" title="加速源切换" onClose={onClose} />

            <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-5 sm:px-6 py-4">
                <p className="text-[13px] leading-[1.6] text-slate-400 m-0 mb-4">
                    歌曲数据、曲绘、音频等资源托管在 GitHub，国内直连较慢。切换加速源后立即生效，并会强制 CDN 回源取最新数据。
                </p>

                <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="加速源">
                    {PROXY_SOURCES.map(source => {
                        const isActive = settings.proxySource === source.id;
                        return (
                            <button
                                key={source.id}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                onClick={() => handleSwitch(source.id)}
                                className={`text-left flex items-center gap-3.5 px-3.5 py-3 rounded-[10px] border transition-colors ${
                                    isActive
                                        ? 'border-[rgba(34,211,238,.5)] bg-[rgba(34,211,238,.06)]'
                                        : 'border-white/[.07] bg-white/[.015] hover:border-white/[.18]'
                                }`}
                            >
                                <span className={`w-4 h-4 flex-none rounded-full border-[1.5px] flex items-center justify-center ${isActive ? 'border-[#22d3ee]' : 'border-slate-600'}`}>
                                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#22d3ee]' : ''}`} />
                                </span>
                                <span className="flex-1 min-w-0 flex flex-col">
                                    <span className="text-sm font-semibold text-slate-200">{source.label}</span>
                                    <span className="text-xs text-slate-400">{source.description}</span>
                                </span>
                                <span className={`font-mono text-[10px] font-medium flex-none ${isActive ? 'text-[#22d3ee]' : 'text-slate-600'}`}>
                                    {PROXY_TAGS[source.id]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <DialogFooter>
                <span className="hidden sm:inline font-mono text-[10px] font-medium tracking-[.1em] text-slate-600">切换后立即生效，无需刷新</span>
                <Button variant="primary" size="md" onClick={onClose}>关闭</Button>
            </DialogFooter>
        </DialogFrame>
    );
};
