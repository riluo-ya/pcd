import React, { useState, useEffect } from 'react';
import { SOURCES, getSourceId, setSourceId } from '../utils/sources';

interface SourcePopupProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SourcePopup: React.FC<SourcePopupProps> = ({ isOpen, onClose }) => {
    const [selected, setSelected] = useState<string>(getSourceId());
    const [switching, setSwitching] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelected(getSourceId());
            setSwitching(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSwitch = (id: string) => {
        if (id === selected) return;
        setSwitching(id);
        setSourceId(id);
        // 延迟触发刷新，让用户看到切换反馈
        window.setTimeout(() => {
            location.reload();
        }, 350);
    };

    return (
        <div
            className="motion-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            aria-labelledby="source-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="motion-dialog relative w-full max-w-md mx-auto overflow-hidden rounded-xl border border-slate-700 shadow-2xl p-6 text-left transform transition-all bg-slate-900/80 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="source-title" className="text-2xl font-bold text-brand-cyan mb-2">
                    加速源切换
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    歌曲数据、曲绘、音频等资源托管在 GitHub，国内直连较慢。切换加速源后可改善加载速度，切换后页面将自动刷新。
                </p>

                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                    {SOURCES.map(source => {
                        const isActive = selected === source.id;
                        const isSwitching = switching === source.id;
                        const isRecommended = source.tag.includes('推荐');
                        return (
                            <div
                                key={source.id}
                                className={`rounded-lg border p-4 transition-colors duration-200 ${
                                    isActive
                                        ? 'border-brand-cyan/70 bg-slate-800/60'
                                        : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-slate-200">{source.name}</span>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${
                                                isRecommended
                                                    ? 'bg-brand-cyan/15 text-brand-cyan'
                                                    : 'bg-slate-600/40 text-slate-300'
                                            }`}
                                        >
                                            {source.tag}
                                        </span>
                                        {isActive && (
                                            <span className="text-xs text-brand-cyan font-medium">使用中</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitch(source.id)}
                                        disabled={isActive || isSwitching}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors duration-200 ${
                                            isActive
                                                ? 'bg-slate-700 text-slate-400 cursor-default'
                                                : isSwitching
                                                    ? 'bg-brand-cyan text-slate-900'
                                                    : 'bg-slate-600 hover:bg-slate-500 text-white'
                                        }`}
                                    >
                                        {isSwitching ? '切换中…' : isActive ? '当前' : '切换'}
                                    </button>
                                </div>
                                <p className="font-mono text-sm text-slate-300">{source.host}</p>
                                <p className="text-xs text-slate-500 mt-1">{source.desc}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 bg-slate-600 hover:bg-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-slate-500"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
