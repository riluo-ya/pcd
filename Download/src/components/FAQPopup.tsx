import React, { useState } from 'react';
import { useFaq } from '../utils/faq';
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
                {(error || sourceLabel) && (
                    <div className="mb-2 flex items-center gap-2 px-1 text-[11px] text-slate-500">
                        <span>{error || (sourceLabel ? `问答来源：${sourceLabel}` : '')}</span>
                        <button type="button" onClick={reload} className="font-semibold text-[#22d3ee] hover:text-[#67e8f9]">重新加载</button>
                    </div>
                )}
                {loading && (
                    <div className="flex items-center justify-center gap-2.5 py-8 text-[13px] text-slate-500">
                        <span className="w-4 h-4 rounded-full border-2 border-white/[.12] border-t-[#22d3ee] animate-spin" />
                        正在加载问答…
                    </div>
                )}
                {faqs.map((item, i) => {
                    const isOpenItem = openIndex === i;
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
                                    {item.answer}
                                    {item.link && (
                                        <>
                                            {' '}
                                            <a href={item.link.url} target="_blank" rel="noreferrer" className="text-[#22d3ee] hover:text-[#67e8f9]">{item.link.text}</a>.
                                        </>
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
