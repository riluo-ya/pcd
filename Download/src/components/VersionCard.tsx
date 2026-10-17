
import React, { memo } from 'react';
import { Spinner } from './Spinner';
import { ErrorIcon, TagIcon } from './Icons';

interface VersionCardProps {
    isLoading: boolean;
    error: string | null;
    version: string | null;
    onRetry?: () => void;
}

/** 资源版本号卡片：展示当前曲库解包自哪个 Phigros 版本 */
export const VersionCard: React.FC<VersionCardProps> = memo(({ isLoading, error, version, onRetry }) => {
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center gap-3 text-slate-400 text-sm">
                    <Spinner />
                    <span>正在获取版本…</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center gap-2 text-[#f87171]">
                    <ErrorIcon className="w-7 h-7" />
                    <span className="text-[13px] font-semibold">加载版本失败。</span>
                    <p className="font-mono text-[11px] text-[#fca5a5] text-center break-all">{error}</p>
                    {onRetry && (
                        <button type="button" onClick={onRetry} className="text-[13px] font-semibold text-[#22d3ee] hover:text-[#67e8f9]">
                            重试
                        </button>
                    )}
                </div>
            );
        }

        if (version) {
            return (
                <div className="flex flex-col items-center gap-1">
                    <span className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[.16em] text-slate-500">
                        <TagIcon className="w-3.5 h-3.5 text-[#22d3ee]" />
                        资源版本
                    </span>
                    <span className="text-[26px] font-bold leading-[1.2] text-slate-100">{version}</span>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="w-full rounded-xl border border-white/[.08] bg-white/[.02] px-5 py-4">
            <div className="flex flex-col items-center justify-center">{renderContent()}</div>
        </div>
    );
});
