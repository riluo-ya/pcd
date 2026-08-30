import React, { useState, useEffect } from 'react';
import { verifyToken, redirectToQuiz } from '../utils/auth';

interface AuthGateProps {
    children: React.ReactNode;
}

/**
 * 访问权限验证门控组件
 * 验证 localStorage 中的 access_token，通过则渲染子组件，失败则显示受限页面。
 * 算法与有效期与答题系统(index.html)完全一致。
 */
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
    const [isVerified, setIsVerified] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [isChecking, setIsChecking] = useState<boolean>(true);

    useEffect(() => {
        const result = verifyToken();
        if (result.valid) {
            setIsVerified(true);
        } else {
            setErrorMsg(result.reason || '验证失败');
        }
        setIsChecking(false);
    }, []);

    // —— 验证中：加载动画 ——
    if (isChecking) {
        return (
            <div style={overlayStyle}>
                <div style={{ textAlign: 'center' }}>
                    <div style={spinnerStyle}></div>
                    <p style={{ color: '#6b7280', fontSize: '1rem', margin: 0 }}>正在验证访问权限...</p>
                </div>
                <style>{spinnerKeyframes}</style>
            </div>
        );
    }

    // —— 验证失败：受限页面 ——
    if (!isVerified) {
        return (
            <div style={overlayStyle}>
                <div style={cardStyle}>
                    <div style={lockIconStyle}>🔒</div>
                    <h2 style={titleStyle}>访问受限</h2>
                    <p style={errorTextStyle}>{errorMsg}</p>
                    <p style={hintStyle}>请先完成答题验证后再访问此页面。</p>
                    <button
                        onClick={() => redirectToQuiz()}
                        style={buttonStyle}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#4338CA'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#4F46E5'; }}
                    >
                        前往答题页
                    </button>
                </div>
            </div>
        );
    }

    // —— 验证通过：渲染正常内容 ——
    return <>{children}</>;
};

// ================= 内联样式 =================
const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const spinnerStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    border: '4px solid rgba(79, 70, 229, 0.3)',
    borderTop: '4px solid #4F46E5',
    borderRadius: '50%',
    animation: 'auth-spin 1s linear infinite',
    margin: '0 auto 16px',
};

const spinnerKeyframes = `
@keyframes auth-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
`;

const cardStyle: React.CSSProperties = {
    background: 'white',
    padding: '40px 30px',
    borderRadius: '16px',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
};

const lockIconStyle: React.CSSProperties = {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#fef2f2',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto 20px',
    fontSize: '32px',
};

const titleStyle: React.CSSProperties = {
    margin: '0 0 12px 0',
    color: '#ef4444',
    fontSize: '1.5rem',
    fontWeight: 700,
};

const errorTextStyle: React.CSSProperties = {
    color: '#6b7280',
    margin: '0 0 8px 0',
    fontSize: '1rem',
    lineHeight: 1.6,
};

const hintStyle: React.CSSProperties = {
    color: '#9ca3af',
    margin: '0 0 24px 0',
    fontSize: '0.9rem',
};

const buttonStyle: React.CSSProperties = {
    background: '#4F46E5',
    color: 'white',
    border: 'none',
    padding: '12px 32px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '1rem',
    width: '100%',
    transition: 'background 0.2s',
};
