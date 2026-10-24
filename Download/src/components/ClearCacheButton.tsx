import React, { useState } from 'react';
import { clearSiteCache, hardReload, KEEP_STORAGE_KEYS } from '../utils/clearCache';
import { bumpCacheEpoch, getSource, getCacheEpoch } from '../utils/sources';

interface ClearCacheButtonProps {
    /** 额外样式类，默认与顶部按钮风格一致 */
    className?: string;
    label?: string;
    /** 是否需要二次确认，默认 true */
    needConfirm?: boolean;
    /** 是否顺带强制 CDN 回源（默认 true，用来解决 CDN 版本落后） */
    bustCdn?: boolean;
    /** 清理完成后的回调，可用于埋点或提示 */
    onDone?: () => void;
}

const DEFAULT_CLASS =
    'px-4 py-2 font-semibold rounded-lg shadow-md transition-colors duration-200 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed';

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
            onDone && onDone();
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

    const src = getSource();
    const btnClass = className || DEFAULT_CLASS;
    const confirming = needConfirm && confirm.pending;

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            title={
                `清理本地缓存并自动刷新页面。\n` +
                `保留：登录凭证、加速源（当前 ${src.name}）、线路偏好。\n` +
                (bustCdn ? '同时强制 CDN 回源，解决数据版本落后。' : '')
            }
            className={
                confirming
                    ? btnClass.replace(/bg-slate-700\/50|hover:bg-slate-700|text-slate-300|hover:text-white/g, '') +
                      ' bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold'
                    : btnClass
            }
        >
            {busy ? '正在清除…' : confirming ? '再点一次确认' : label}
        </button>
    );
};

/** 给「设置」弹窗用的详细说明组件：展示清缓存会保留什么 */
export const ClearCacheInfo: React.FC = () => {
    const src = getSource();
    const epoch = getCacheEpoch();
    return (
        <div className="text-xs text-slate-400 space-y-1">
            <div>
                当前加速源：<span className="text-slate-200">{src.name}</span>
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
