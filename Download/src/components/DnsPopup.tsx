import React, { useState, useEffect } from 'react';
import { DialogFrame, DialogHeader, DialogFooter, Button } from './ui/Dialog';

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
    { id: 'alidns', name: '阿里 AliDNS', primary: '223.5.5.5', secondary: '223.6.6.6', tag: '国内', desc: '阿里巴巴公共 DNS，国内速度快、解析稳定。' },
    { id: 'dnspod', name: '腾讯 DNSPod', primary: '119.29.29.29', secondary: '119.28.28.28', tag: '国内', desc: '腾讯云公共 DNS，国内延迟低，支持 DoH。' },
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
        <DialogFrame onClose={onClose} labelledBy="dns-title" className="w-full max-w-[520px] max-h-[min(80dvh,680px)]">
            <DialogHeader id="dns-title" eyebrow="Network" title="DNS 切换" onClose={onClose} />

            <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-5 sm:px-6 py-4">
                <p className="text-[13px] leading-[1.6] text-slate-400 m-0 mb-4">
                    GitHub 在国内网络环境下访问较慢，切换合适的公共 DNS 可改善解析速度。点击「复制」获取配置后，请到系统网络设置中粘贴生效。
                </p>

                <div className="flex flex-col gap-2.5">
                    {DNS_PROVIDERS.map(provider => {
                        const isActive = selected === provider.id;
                        const isCopied = copied === provider.id;
                        return (
                            <div
                                key={provider.id}
                                className={`rounded-[10px] border px-3.5 py-3 transition-colors ${
                                    isActive
                                        ? 'border-[rgba(34,211,238,.5)] bg-[rgba(34,211,238,.05)]'
                                        : 'border-white/[.07] bg-white/[.015] hover:border-white/[.18]'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3 mb-1.5">
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="text-sm font-semibold text-slate-200">{provider.name}</span>
                                        <span className={`font-mono text-[10px] font-medium px-1.5 py-0.5 rounded ${provider.tag === '国内' ? 'text-[#22d3ee] bg-[rgba(34,211,238,.1)]' : 'text-slate-400 bg-white/[.06]'}`}>
                                            {provider.tag}
                                        </span>
                                        {isActive && (
                                            <span className="font-mono text-[10px] font-medium text-[#22d3ee]">使用中</span>
                                        )}
                                    </div>
                                    <Button
                                        variant={isCopied ? 'primary' : 'outline'}
                                        onClick={() => handleCopy(provider)}
                                    >
                                        {isCopied ? '已复制' : '复制'}
                                    </Button>
                                </div>
                                <p className="font-mono text-xs text-slate-300 m-0">
                                    {provider.primary}
                                    {provider.secondary ? ` / ${provider.secondary}` : ''}
                                </p>
                                <p className="text-xs text-slate-500 m-0 mt-1">{provider.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <DialogFooter>
                <span className="hidden sm:inline font-mono text-[10px] font-medium tracking-[.1em] text-slate-600">DNS 只影响域名解析，不影响站点数据</span>
                <Button variant="primary" size="md" onClick={onClose}>关闭</Button>
            </DialogFooter>
        </DialogFrame>
    );
};
