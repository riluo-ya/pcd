import React, { useState, useEffect } from 'react';

interface DnsPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

interface DnsProvider {
    id: string;
    name: string;
    primary: string;
    secondary?: string;
    tag: string;
    desc: string;
}

const DNS_PROVIDERS: DnsProvider[] = [
    { id: 'alidns', name: '阿里 AliDNS', primary: '223.5.5.5', secondary: '223.6.6.6', tag: '国内 · 推荐', desc: '阿里巴巴公共 DNS，国内速度快、解析稳定。' },
    { id: 'dnspod', name: '腾讯 DNSPod', primary: '119.29.29.29', secondary: '119.28.28.28', tag: '国内 · 推荐', desc: '腾讯云公共 DNS，国内延迟低，支持 DoH。' },
    { id: '114dns', name: '114DNS', primary: '114.114.114.114', secondary: '114.114.115.115', tag: '国内', desc: '老牌公共 DNS，简单可靠。' },
    { id: 'baidu', name: '百度 DNS', primary: '180.76.76.76', tag: '国内', desc: '百度公共 DNS，国内可用性高。' },
    { id: 'google', name: '谷歌 Google', primary: '8.8.8.8', secondary: '8.8.4.4', tag: '国际', desc: '全球通用，但国内访问可能不稳定。' },
    { id: 'cloudflare', name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', tag: '国际', desc: '注重隐私与速度，国内连接质量一般。' },
];

const STORAGE_KEY = 'pcd_dns_selected';

export const DnsPopup: React.FC<DnsPopupProps> = ({ isOpen, onClose }) => {
    const [selected, setSelected] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) || '';
        } catch {
            return '';
        }
    });
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setCopied(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCopy = async (provider: DnsProvider) => {
        const text = provider.secondary
            ? `${provider.primary}\n${provider.secondary}`
            : provider.primary;

        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // 剪贴板 API 不可用时降级
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }

        setSelected(provider.id);
        try {
            localStorage.setItem(STORAGE_KEY, provider.id);
        } catch {
            /* 忽略存储失败 */
        }
        setCopied(provider.id);
        window.setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div
            className="motion-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            aria-labelledby="dns-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="motion-dialog relative w-full max-w-md mx-auto overflow-hidden rounded-xl border border-slate-700 shadow-2xl p-6 text-left transform transition-all bg-slate-900/80 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="dns-title" className="text-2xl font-bold text-brand-cyan mb-2">
                    DNS 切换
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed mb-5">
                    GitHub 在国内网络环境下访问较慢，切换合适的公共 DNS 可改善解析速度。点击「复制」获取配置后，请到系统网络设置中粘贴生效。
                </p>

                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                    {DNS_PROVIDERS.map(provider => {
                        const isActive = selected === provider.id;
                        const isCopied = copied === provider.id;
                        return (
                            <div
                                key={provider.id}
                                className={`rounded-lg border p-4 transition-colors duration-200 ${
                                    isActive
                                        ? 'border-brand-cyan/70 bg-slate-800/60'
                                        : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-slate-200">{provider.name}</span>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full ${
                                                provider.tag.startsWith('国内')
                                                    ? 'bg-brand-cyan/15 text-brand-cyan'
                                                    : 'bg-slate-600/40 text-slate-300'
                                            }`}
                                        >
                                            {provider.tag}
                                        </span>
                                        {isActive && (
                                            <span className="text-xs text-brand-cyan font-medium">使用中</span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(provider)}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors duration-200 ${
                                            isCopied
                                                ? 'bg-brand-cyan text-slate-900'
                                                : 'bg-slate-600 hover:bg-slate-500 text-white'
                                        }`}
                                    >
                                        {isCopied ? '已复制' : '复制'}
                                    </button>
                                </div>
                                <p className="font-mono text-sm text-slate-300">
                                    {provider.primary}
                                    {provider.secondary ? ` / ${provider.secondary}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">{provider.desc}</p>
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
