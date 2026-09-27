import React, { useState } from 'react';
import { clearSiteCache, hardReload } from '../utils/clearCache';

interface ClearCacheButtonProps {
    /** 额外样式类，默认与顶部按钮风格一致 */
    className?: string;
    label?: string;
    /** 是否需要二次确认，默认 true */
    needConfirm?: boolean;
}

const DEFAULT_CLASS =
    'px-4 py-2 font-semibold rounded-lg shadow-md transition-colors duration-200 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed';

export const ClearCacheButton: React.FC<ClearCacheButtonProps> = ({
    className,
    label = '清除缓存',
    needConfirm = true,
}) => {
    const [busy, setBusy] = useState(false);

    const handleClick = async () => {
        if (busy) return;

        if (needConfirm) {
            const ok = window.confirm(
                '确定清除本站缓存吗？\n\n将清理本地设置、缓存数据，然后自动刷新页面。\n登录凭证会保留，无需重新答题。'
            );
            if (!ok) return;
        }

        setBusy(true);
        try {
            await clearSiteCache();
            await hardReload();
            // 正常情况页面已经跳转，不会走到这里
        } catch (e) {
            console.error('[clearCache] 清除失败', e);
            setBusy(false);
            window.alert('清除失败，请手动刷新页面后重试。');
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            title="清理本地缓存并自动刷新页面"
            className={className || DEFAULT_CLASS}
        >
            {busy ? '正在清除…' : label}
        </button>
    );
};
