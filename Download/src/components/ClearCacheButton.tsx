import React, { useState } from 'react';
import { clearSiteCache, hardReload, KEEP_STORAGE_KEYS } from '../utils/clearCache';
import { bumpCacheEpoch, getCacheEpoch, PROXY_SOURCES } from '../utils/resourceUrls';
import { useSettings } from '../contexts/SettingsContext';

export const CLEAR_CACHE_BUTTON_CLASS =
    'px-3.5 py-2 text-[13px] rounded-lg font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed border border-white/[.12] hover:bg-white/[.05] text-slate-200';

interface ClearCacheButtonProps {
    /** 额外样式类，默认与弹窗按钮风格一致 */
    className?: string;
    label?: string;
    /** 是否需要二次确认，默认 true */
    needConfirm?: boolean;
    /** 是否顺带强制 CDN 回源（默认 true，用来解决 CDN 版本落后） */
    bustCdn?: boolean;
    /** 清理完成后的回调，可用于埋点或提示 */
    onDone?: () => void;
}

/** 用「点两下确认」代替 confirm 弹窗 —— 手机 / WebView 里弹窗常被拦，点了会没反应 */
function useTwoStepConfirm(resetMs = 3000) {
    const [pending, setPending] = useState(false);
    const timer = React.useRef<number | null>(null);

    const clear = () => {
        if (timer.current) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
    };

    const arm = () => {
        setPending(true);
        clear();
        timer.current = window.setTimeout(() => setPending(false), resetMs);
    };

    const disarm = () => {
        clear();
        setPending(false);
    };

    React.useEffect(() => clear, []);

    return { pending, arm, disarm };
}

export const ClearCacheButton: React.FC<ClearCacheButtonProps> = ({
    className,
    label = '清除缓存',
    needConfirm = true,
    bustCdn = true,
    onDone,
}) => {
    const { settings } = useSettings();
    const [busy, setBusy] = useState(false);
    const confirm = useTwoStepConfirm();

    const run = async () => {
        setBusy(true);
        try {
            // 先 bump CDN 版本号，再清理本地 —— 顺序不能反，
            // 否则刚写进去的 epoch 会被清掉，刷新后又拿回 CDN 旧缓存。
            if (bustCdn) bumpCacheEpoch();

            await clearSiteCache();
            await hardReload();
            onDone?.();
            // 正常情况页面已经跳转，不会走到这里
        } catch (e) {
            console.error('[clearCache] 清除失败', e);
            setBusy(false);
            confirm.disarm();
        }
    };

    const handleClick = () => {
        if (busy) return;
        if (!needConfirm) {
            run();
            return;
        }
        if (confirm.pending) {
            confirm.disarm();
            run();
        } else {
            confirm.arm();
        }
    };

    const sourceName = PROXY_SOURCES.find(s => s.id === settings.proxySource)?.label ?? settings.proxySource;
    const confirming = needConfirm && confirm.pending;

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            title={
                `清理本地缓存并自动刷新页面。\n` +
                `保留：登录凭证、加速源（当前 ${sourceName}）、线路偏好。\n` +
                (bustCdn ? '同时强制 CDN 回源，解决数据版本落后。' : '')
            }
            className={
                confirming
                    ? 'px-3.5 py-2 text-[13px] rounded-lg font-semibold transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed bg-[#fbbf24] hover:bg-[#fcd34d] text-[#1a1204] font-bold'
                    : className || CLEAR_CACHE_BUTTON_CLASS
            }
        >
            {busy ? '正在清除…' : confirming ? '再点一次确认' : label}
        </button>
    );
};

/** 给「设置」弹窗用的详细说明组件：展示清缓存会保留什么 */
export const ClearCacheInfo: React.FC = () => {
    const { settings } = useSettings();
    const sourceName = PROXY_SOURCES.find(s => s.id === settings.proxySource)?.label ?? settings.proxySource;
    const epoch = getCacheEpoch();
    return (
        <div className="text-[13px] leading-[1.5] text-slate-400 space-y-1">
            <div>
                当前加速源：<span className="text-slate-200">{sourceName}</span>
                <span className="text-slate-500">（清除缓存后保持不变）</span>
            </div>
            <div>
                CDN 版本号：
                <span className="text-slate-200">{epoch || '未设置（走共享缓存）'}</span>
            </div>
            <div>保留项：登录凭证、加速源、线路偏好、CDN 版本号</div>
        </div>
    );
};

export { KEEP_STORAGE_KEYS };
