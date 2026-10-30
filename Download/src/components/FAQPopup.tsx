
import React, { useRef } from 'react';
import { useFaq, urlHost } from '../utils/faqLoader';
import { useSettings } from '../contexts/SettingsContext';
import { useVirtualizer } from '@tanstack/react-virtual';

interface FAQPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AccordionItemProps {
    question: string;
    children: string;
    isLast: boolean;
    links?: { text: string; url: string }[];
}

const AccordionItem: React.FC<AccordionItemProps> = ({ question, children, isLast, links }) => (
    <details className={`group border-b border-slate-700/50 py-4 ${isLast ? 'border-none' : ''}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-200 hover:text-white">
            {question}
            <div className="text-slate-400 group-hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 transition-transform duration-300 group-open:rotate-180">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </div>
        </summary>
        <div className="mt-4 text-slate-400" dangerouslySetInnerHTML={{ __html: children }} />
        {links && links.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
                {links.map((lk, i) => (
                    <a
                        key={i}
                        href={lk.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-700/60 bg-slate-800/40 hover:border-[#22d3ee]/45 hover:bg-[#22d3ee]/[.06] transition-colors"
                    >
                        <span className="flex-none w-7 h-7 rounded-md bg-[#22d3ee]/12 flex items-center justify-center text-[13px]">🔗</span>
                        <span className="flex-1 min-w-0">
                            <span className="block text-[13px] text-slate-200 truncate">{lk.text}</span>
                            <span className="block text-[11px] text-slate-500 truncate">{urlHost(lk.url)}</span>
                        </span>
                        <span className="flex-none text-slate-500 text-xs">↗</span>
                    </a>
                ))}
            </div>
        )}
    </details>
);

export const FAQPopup: React.FC<FAQPopupProps> = ({ isOpen, onClose }) => {
    const { settings } = useSettings();
    const parentRef = useRef<HTMLDivElement>(null);

    // 问答来自外部 faq.json，加载失败自动回退到内置数据
    const { faqs, notice, sourceLabel, loading, error, reload } = useFaq();

    const rowVirtualizer = useVirtualizer({
        count: faqs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100,
    });

    if (!isOpen) return null;

    return (
        <div 
            className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 max-md:p-0 max-md:items-end bg-[rgba(4,6,10,.78)] backdrop-blur-[6px]"
            aria-labelledby="faq-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                className={`motion-dialog relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl border border-white/[.08] bg-[rgba(12,15,22,.97)] shadow-[0_40px_120px_rgba(0,0,0,.6)] transform transition-all flex flex-col max-md:w-full max-md:max-w-none h-dialog-panel max-md:rounded-b-none max-md:border-b-0 ${settings.useNewUi ? 'backdrop-blur-md' : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="dialog-topline" style={{ background: 'linear-gradient(90deg, transparent, rgba(34,211,238,.7), transparent)' }} />
                <div className="h-[68px] flex-none flex items-center justify-between gap-3 px-6 max-md:px-5 border-b border-white/[.06]">
                    <div className="flex flex-col">
                        <span className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[.16em] uppercase text-[#22d3ee]">Help</span>
                        <h2 id="faq-title" className="text-[21px] font-semibold leading-[1.25] text-slate-100">常见问题</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex-none w-[34px] h-[34px] max-md:w-11 max-md:h-11 max-md:-mr-1.5 max-md:rounded-[10px] rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[.06] hover:text-slate-200 transition-colors">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* 数据来源：读成功显示来源，失败显示「内置兜底」
                    内置数据与 faq.json 内容一致，光看问答内容分不出来，
                    必须把这行标识露出来，否则线上没生效也发现不了 */}
                {!loading && (
                    <div className="flex-none px-6 max-md:px-5 pt-3">
                        <div className="flex items-center gap-2 text-[11px]">
                            <span className={`flex-none w-1.5 h-1.5 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            <span className={error ? 'text-amber-300' : 'text-slate-400'}>
                                {error ? '内置数据（在线 faq.json 加载失败）' : `数据来源：${sourceLabel}`}
                            </span>
                        </div>
                    </div>
                )}

                {(notice || error) && (
                    <div className="flex-none px-6 max-md:px-5 pt-4">
                        {notice && (
                            <div className="px-3 py-2 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/10 text-[13px] text-slate-200">
                                {notice}
                            </div>
                        )}
                        {error && (
                            <div className="mt-2 flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[12px] text-amber-300">
                                <span className="min-w-0 truncate">{error}</span>
                                <button
                                    type="button"
                                    onClick={reload}
                                    className="flex-none px-2.5 py-1 rounded-md border border-amber-500/40 hover:bg-amber-500/15 transition-colors"
                                >
                                    重试
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div
                    ref={parentRef}
                    className="flex-1 min-h-0 max-h-[60vh] max-md:max-h-none overflow-y-auto px-6 custom-scrollbar"
                >
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                            const item = faqs[virtualItem.index];
                            return (
                                <div
                                    key={virtualItem.key}
                                    ref={rowVirtualizer.measureElement}
                                    data-index={virtualItem.index}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                >
                                    <AccordionItem
                                        question={item.question || '(未填问题)'}
                                        isLast={virtualItem.index === faqs.length - 1}
                                        links={item.links}
                                    >
                                        {item.answer || '(未填答案)'}
                                    </AccordionItem>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 p-6 bg-slate-900/50 border-t border-slate-800">
                    <span className="font-mono text-[10px] tracking-[.14em] text-slate-500">
                        {loading ? '加载中…' : sourceLabel ? `来源：${sourceLabel}` : '来源：内置'}
                    </span>
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
