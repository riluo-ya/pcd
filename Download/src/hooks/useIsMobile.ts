import { useEffect, useState } from 'react';

// 与 Tailwind 的 `max-md` 断点保持一致：手机走专用布局，平板及以上仍是左右分栏。
const MOBILE_QUERY = '(max-width: 767.98px)';

/**
 * 手机端用的是另一套组件树（MobileLayout），不是靠 CSS 响应式硬凑 ——
 * 两者的交互差别太大（推入式页面、底部抽屉、固定导出栏），只用断点做不出同样的手感。
 */
export const useIsMobile = (): boolean => {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
    );

    useEffect(() => {
        const mql = window.matchMedia(MOBILE_QUERY);
        const update = () => setIsMobile(mql.matches);
        update();
        mql.addEventListener('change', update);
        return () => mql.removeEventListener('change', update);
    }, []);

    return isMobile;
};
