import React, { useState } from 'react';
import { useFaq, linkHost } from '../utils/faq';
import { DialogFrame, DialogFooter, DialogHeader, Button } from './ui/Dialog';
import { ChevronDownIcon } from './Icons';

interface FAQPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

const REPO_ISSUES_URL = 'https://github.com/swordalt/phigros-chart-downloader/issues';

export const FAQPopup: React.FC<FAQPopupProps> = ({ isOpen, onClose }) => {
    // One question open at a time; the first starts open.
    const [openIndex, setOpenIndex] = useState<number>(0);
    // 问答内容来自外部 faq.json，改完推送即可更新，加载失败自动回退内置版本
    const { faqs, notice, sourceLabel, loading, error, reload } = useFaq();

    if (!isOpen) return null;

    return (
        <DialogFrame onClose={onClose} labelledBy="faq-title" className="w-full max-w-[680px] max-h-[calc(100dvh-32px)]">
            <DialogHeader id="faq-title" eyebrow="帮助" title="常见问题" onClose={onClose} />

            <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-6 max-md:px-5 pt-2 pb-3 flex flex-col">
                {notice && (
                    <p className="mb-2 px-3 py-2 rounded-lg bg-[rgba(34,211,238,.08)] border border-[rgba(34,211,238,.2)] text-[13px] leading-[1.6] text-slate-300">
                        {notice}
                    </p>
                )}
                <div className="mb-2 flex items-center gap-2 px-1 text-[11px] text-slate-500">
                    <span>
                        {loading
                            ? '正在加载问答…'
                            : error
                                ? `${error}（共 ${faqs.length} 条）`
                                : `问答来源：${sourceLabel || '内置'} · 共 ${faqs.length} 条`}
                    </span>
                    <button type="button" onClick={reload} className="font-semibold text-[#22d3ee] hover:text-[#67e8f9]">重新加载</button>
                </div>
                {faqs.map((item, i) => {
                    const isOpenItem = openIndex === i;
                    // links 优先，兼容只有单条 link 的旧数据
                    const links = item.links && item.links.length ? item.links : item.link ? [item.link] : [];
                    return (
                        <div key={item.question} className={i ? 'border-t border-white/[.06]' : ''}>
                            <button
                                type="button"
                                onClick={() => setOpenIndex(isOpenItem ? -1 : i)}
                                aria-expanded={isOpenItem}
                                className="w-full text-left grid grid-cols-[32px_minmax(0,1fr)_16px] items-center gap-2 py-[15px]"
                            >
                                <span className={`font-mono text-[11px] font-medium ${isOpenItem ? 'text-[#22d3ee]' : 'text-slate-600'}`}>
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <span className={`text-[15px] font-medium ${isOpenItem ? 'text-slate-100' : 'text-slate-300 hover:text-slate-100'}`}>
                                    {item.question}
                                </span>
                                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpenItem ? 'rotate-180' : ''}`} />
                            </button>
                            {isOpenItem && (
                                <div className="pl-10 pr-6 max-md:pr-2 pb-4 text-sm leading-[1.65] text-slate-400 text-pretty">
                                    {/* links 优先，兼容只有单条 link 的旧数据 */}
                                    {item.answer}
                                    {links.length > 0 && (
                                        <div className="mt-3 flex flex-col gap-1.5">
                                            {links.map(l => (
                                                <a
                                                    key={l.url + '|' + l.text}
                                                    href={l.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="group flex items-center gap-2.5 px-3 py-2 rounded-lg border border-white/[.08] bg-white/[.025] no-underline transition-colors hover:border-[rgba(34,211,238,.4)] hover:bg-[rgba(34,211,238,.07)] active:bg-[rgba(34,211,238,.12)]"
                                                >
                                                    <span
                                                        className="flex-none w-7 h-7 rounded-md flex items-center justify-center text-[13px] leading-none"
                                                        style={{ background: 'rgba(34,211,238,.12)' }}
                                                        aria-hidden="true"
                                                    >
                                                        🔗
                                                    </span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block text-[13px] font-medium text-slate-200 truncate group-hover:text-white">
                                                            {l.text}
                                                        </span>
                                                        <span className="block text-[11px] text-slate-500 truncate">
                                                            {linkHost(l.url)}
                                                        </span>
                                                    </span>
                                                    <svg
                                                        className="flex-none w-3.5 h-3.5 text-slate-600 group-hover:text-[#22d3ee] transition-colors"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        strokeWidth={1.8}
                                                        stroke="currentColor"
                                                        aria-hidden="true"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                                    </svg>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <DialogFooter>
                <span className="text-[13px] text-slate-500">
                    还有疑问？去{' '}
                    <a href={REPO_ISSUES_URL} target="_blank" rel="noreferrer" className="text-[#22d3ee] hover:text-[#67e8f9]">GitHub</a>
                    {' '}提个 issue
                </span>
                <Button variant="outline" size="md" onClick={onClose}>关闭</Button>
            </DialogFooter>
        </DialogFrame>
    );
};
