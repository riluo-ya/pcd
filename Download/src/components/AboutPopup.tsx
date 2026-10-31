
import React, { useRef } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { projectDescription } from '../aboutData';
import { useChangelog } from '../utils/changelog';

interface AboutPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AccordionItemProps {
    title: string;
    children: React.ReactNode;
    isLast: boolean;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ title, children, isLast }) => (
    <details className={`group border-b border-slate-700/50 py-4 ${isLast ? 'border-none' : ''}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-slate-200 hover:text-white transition-colors">
            {title}
            <div className="text-slate-400 group-hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5 transition-transform duration-300 group-open:rotate-180">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
            </div>
        </summary>
        <div className="mt-4 text-slate-400 text-sm">
            {children}
        </div>
    </details>
);

export const AboutPopup: React.FC<AboutPopupProps> = ({ isOpen, onClose }) => {
    const { settings } = useSettings();
    const scrollRef = useRef<HTMLDivElement>(null);

    // 更新日志来自外部 changelog.json，加载失败自动回退到内置数据
    const { logs, notice, sourceLabel, loading, error, reload } = useChangelog();

    const latestLog = logs[0];
    const pastLogs = logs.slice(1);

    if (!isOpen) return null;

    return (
        <div
            className="motion-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 max-md:p-0 max-md:items-end bg-[rgba(4,6,10,.78)] backdrop-blur-[6px]"
            aria-labelledby="about-title"
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
                        <span className="flex items-center gap-2 font-mono text-[10px] font-medium tracking-[.16em] uppercase text-[#22d3ee]">项目</span>
                        <h2 id="about-title" className="text-[21px] font-semibold leading-[1.25] text-slate-100">关于项目</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="flex-none w-[34px] h-[34px] max-md:w-11 max-md:h-11 max-md:-mr-1.5 max-md:rounded-[10px] rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[.06] hover:text-slate-200 transition-colors">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    {/* 项目简介 */}
                    <div className="p-6 max-md:p-5 border-b border-white/[.06]">
                        <p className="text-slate-300 text-sm leading-relaxed">
                            {projectDescription}
                        </p>
                    </div>

                    {/* 日志加载状态 / 来源信息 */}
                    <div className="px-6 pt-4">
                        {loading ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                                正在加载更新日志…
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-2">
                                    <span className={`flex-none w-1.5 h-1.5 rounded-full ${error ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                    <span className={error ? 'text-amber-300' : 'text-slate-500'}>
                                        {error ? '内置数据（在线 changelog.json 加载失败）' : `更新日志 · 数据来源：${sourceLabel}`}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    onClick={reload}
                                    className="px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                                    title="重新拉取 changelog.json"
                                >
                                    刷新日志
                                </button>
                            </div>
                        )}

                        {/* 全部数据源都失败时的提示（此时显示的是内置兜底日志） */}
                        {!loading && error && (
                            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-900/20 p-3 text-xs text-amber-300">
                                <span className="mt-px">⚠</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* 可选公告，在 changelog.json 里填 notice 即可显示 */}
                        {!loading && notice && (
                            <div
                                className="mt-3 rounded-lg border border-brand-cyan/30 bg-brand-cyan/10 p-3 text-sm text-slate-200"
                                dangerouslySetInnerHTML={{ __html: notice }}
                            />
                        )}
                    </div>

                    {/* 最新更新 */}
                    {!loading && latestLog && (
                        <div className="px-6 pt-6 pb-2">
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="px-2 py-1 rounded bg-brand-cyan/20 text-brand-cyan text-xs font-bold uppercase tracking-wider">最新更新</span>
                                    <h3 className="font-bold text-white text-lg">{latestLog.date}</h3>
                                </div>
                                <div
                                    className="bg-slate-800/50 rounded-lg p-4 text-slate-300 text-sm border border-slate-700/50"
                                    dangerouslySetInnerHTML={{ __html: latestLog.content }}
                                />
                            </div>
                        </div>
                    )}

                    {/* 版本历史 */}
                    {!loading && pastLogs.length > 0 && (
                        <>
                            <div className="px-6 pt-2 pb-2">
                                <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider">版本历史</h3>
                            </div>
                            <div className="px-6">
                                {pastLogs.map((log, idx) => (
                                    <AccordionItem
                                        key={`${log.date}-${idx}`}
                                        title={log.date}
                                        isLast={idx === pastLogs.length - 1}
                                    >
                                        <div dangerouslySetInnerHTML={{ __html: log.content }} />
                                    </AccordionItem>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 text-right bg-slate-900/50 border-t border-slate-800 shrink-0">
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
