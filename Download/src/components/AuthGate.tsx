import React, { useState, useEffect } from 'react';
import { verifyToken, redirectToQuiz, willReturnAfterQuiz } from '../utils/auth';

interface AuthGateProps {
    children: React.ReactNode;
}

/**
 * 访问权限验证门控组件
 * 验证 localStorage 中的 access_token，通过则渲染子组件，失败则显示受限页面。
 * 算法与有效期与答题系统（quiz.html）完全一致。
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
    const [isVerified, setIsVerified] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isChecking, setIsChecking] = useState<boolean>(true);
    // 分享链接（?song=xxx）答完题会回到本页，直接访问的首页则会去导航中心
    const [willReturn, setWillReturn] = useState<boolean>(false);

    useEffect(() => {
        const result = verifyToken();
        if (result.valid) {
            setIsVerified(true);
        } else {
            setErrorMsg(result.reason || '验证失败');
            setWillReturn(willReturnAfterQuiz());
        }
        setIsChecking(false);
    }, []);

    if (isChecking) {
        return (
            <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#090b10]">
                <span className="w-9 h-9 rounded-full border-2 border-white/[.12] border-t-[#22d3ee] animate-spin" />
                <p className="m-0 text-sm text-slate-500">正在验证访问权限…</p>
            </div>
        );
    }

    if (!isVerified) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-5 bg-[#090b10]">
                <div className="w-full max-w-[400px] flex flex-col items-center text-center rounded-2xl border border-white/[.08] bg-[rgba(12,15,22,.97)] px-7 py-9 shadow-[0_40px_120px_rgba(0,0,0,.6)]">
                    <span className="w-16 h-16 mb-5 rounded-full flex items-center justify-center text-[32px] bg-[rgba(248,113,113,.08)]">
                        🔒
                    </span>
                    <h2 className="m-0 mb-3 text-[21px] font-semibold text-[#f87171]">访问受限</h2>
                    <p className="m-0 mb-2 text-[15px] leading-relaxed text-slate-400">{errorMsg}</p>
                    <p className="m-0 mb-7 text-[13px] leading-relaxed text-slate-600">
                        请先完成答题验证，通过后{willReturn ? '会自动返回本页' : '会自动前往导航中心'}。
                    </p>
                    <button
                        type="button"
                        onClick={() => redirectToQuiz()}
                        className="w-full h-[52px] rounded-[10px] bg-[#22d3ee] hover:bg-[#67e8f9] text-[#06141a] font-bold text-[15px] tracking-[.04em] transition-colors"
                    >
                        前往答题页
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
