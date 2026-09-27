
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
            className="motion-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            aria-labelledby="about-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className={`motion-dialog relative w-full max-w-2xl mx-auto overflow-hidden rounded-xl border border-slate-700 shadow-2xl transform transition-all flex flex-col max-h-[80vh] ${
                    settings.useNewUi ? 'bg-slate-900/80 backdrop-blur-md' : 'bg-slate-900'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* 标题与项目简介 */}
                    <div className="p-6 border-b border-slate-700/50">
                        <h2 id="about-title" className="text-2xl font-bold text-brand-cyan mb-2">
                            关于项目
                        </h2>
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
                                <span>
                                    更新日志
                                    {sourceLabel ? ` · 来源：${sourceLabel}` : ''}
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
