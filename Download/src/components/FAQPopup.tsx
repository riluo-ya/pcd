
import React, { useRef } from 'react';
import { faqData } from '../faqData';
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
}

const AccordionItem: React.FC<AccordionItemProps> = ({ question, children, isLast }) => (
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
    </details>
);

export const FAQPopup: React.FC<FAQPopupProps> = ({ isOpen, onClose }) => {
    const { settings } = useSettings();
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: faqData.length,
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
                className={`motion-dialog relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl border border-white/[.08] bg-[rgba(12,15,22,.97)] shadow-[0_40px_120px_rgba(0,0,0,.6)] transform transition-all flex flex-col max-md:w-full max-md:max-w-none max-md:h-[calc(100dvh-10px)] max-md:max-h-none max-md:rounded-b-none max-md:border-b-0 ${settings.useNewUi ? 'backdrop-blur-md' : ''}`}
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

                <div 
                    ref={parentRef} 
                    className="max-h-[60vh] overflow-y-auto px-6 custom-scrollbar"
                >
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                            const item = faqData[virtualItem.index];
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
                                        question={item.question} 
                                        isLast={virtualItem.index === faqData.length - 1}
                                    >
                                        {item.answer}
                                    </AccordionItem>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 text-right bg-slate-900/50 border-t border-slate-800">
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
