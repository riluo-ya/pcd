
import React, { memo } from 'react';
import { ClearCacheButton } from './ClearCacheButton';

interface HeaderProps {
    version: string | null;
    isLoadingVersion: boolean;
    versionError: string | null;
    onRetryVersion: () => void;
    onSettingsClick: () => void;
    onFaqClick: () => void;
    onAboutClick: () => void;
    onSourceClick: () => void;
}

/**
 * 资源版本胶囊：用圆点颜色表示加载状态，失败时可点击重试。
 * 对齐上游的 AssetsPill —— 版本信息从原来的独立卡片移到了顶栏。
 */
const AssetsPill: React.FC<Pick<HeaderProps, 'version' | 'isLoadingVersion' | 'versionError' | 'onRetryVersion'>> = ({
    version,
    isLoadingVersion,
    versionError,
    onRetryVersion,
}) => {
    const dot = versionError ? '#f87171' : isLoadingVersion ? '#fbbf24' : '#4ade80';
    const label = versionError ? '加载失败' : isLoadingVersion ? '加载中 …' : `Phigros v${version}`;
    const content = (
        <>
            <span
                className={`w-1.5 h-1.5 rounded-full ${isLoadingVersion ? 'animate-pulse' : ''}`}
                style={{ background: dot, boxShadow: `0 0 8px ${dot}` }}
            />
            {label}
        </>
    );
    const className =
        'flex items-center gap-2 px-3 py-[5px] rounded-full border border-white/[.08] font-mono text-[11px] font-medium text-slate-400 whitespace-nowrap';

    if (versionError) {
        return (
            <button
                type="button"
                onClick={onRetryVersion}
                title={`${versionError} — 点击重试`}
                className={`${className} hover:border-white/[.18] hover:text-slate-200 transition-colors`}
            >
                {content}
            </button>
        );
    }
    return (
        <span className={className} title="资源解包自该游戏版本">
            {content}
        </span>
    );
};

export const Header: React.FC<HeaderProps> = memo(
    ({ onSettingsClick, onFaqClick, onAboutClick, onSourceClick, ...versionProps }) => {
        const navButton =
            'px-3 py-1.5 text-[13px] text-slate-400 rounded-md hover:text-white hover:bg-white/[.05] transition-colors';
        return (
            <header className="h-14 flex-none flex items-center justify-between gap-4 px-4 sm:px-6 border-b border-white/[.1] bg-[#05070a]">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-[18px] h-[18px] flex-none bg-[#22d3ee] -skew-x-[14deg]" aria-hidden="true" />
                    <h1 className="font-semibold text-sm tracking-[.18em] text-slate-100 truncate">
                        Phigros 谱面下载器
                    </h1>
                </div>
                <nav className="flex items-center gap-1.5 flex-none">
                    <span className="hidden md:flex">
                        <AssetsPill {...versionProps} />
                    </span>
                    <span className="hidden md:block w-px h-5 bg-white/[.08] mx-2.5" aria-hidden="true" />
                    <a href="./home.html" className={`${navButton} hidden sm:block`}>
                        返回导航
                    </a>
                    <button type="button" onClick={onAboutClick} className={navButton}>
                        关于
                    </button>
                    <button type="button" onClick={onFaqClick} className={navButton}>
                        常见问题
                    </button>
                    <button type="button" onClick={onSourceClick} className={`${navButton} hidden sm:block`}>
                        加速源
                    </button>
                    <span className="hidden sm:block">
                        <ClearCacheButton />
                    </span>
                    <button
                        type="button"
                        onClick={onSettingsClick}
                        aria-label="设置"
                        title="设置"
                        className="w-[34px] h-[34px] flex items-center justify-center rounded-lg border border-white/[.08] text-slate-300 hover:bg-white/[.05] transition-colors"
                    >
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
                            />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </nav>
            </header>
        );
    }
);
