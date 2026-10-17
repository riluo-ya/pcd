import React, { useState } from 'react';
import { projectDescription } from '../aboutData';
import { useChangelog } from '../utils/changelog';
import { DialogFrame, DialogFooter, Eyebrow, CloseButton, Button } from './ui/Dialog';
import { ChevronDownIcon } from './Icons';
import { VersionCard } from './VersionCard';

interface AboutPopupProps {
    isOpen: boolean;
    onClose: () => void;
    version: string | null;
    isLoadingVersion: boolean;
    errorVersion: string | null;
    onRetryVersion: () => void;
}

const REPO_URL = 'https://github.com/swordalt/phigros-chart-downloader/';
const SITE_URL = 'https://github.com/riluo-ya/pcd/';

// 更新日志以 HTML 列表存储；把每个 <li> 的文本抽出来。
const parseLogItems = (html: string): string[] => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = Array.from(doc.querySelectorAll('li'))
        .map(li => (li.textContent || '').trim())
        .filter(Boolean);
    if (items.length > 0) return items;
    // 没有列表标签时（纯文本日志）按段落兜底
    return Array.from(doc.querySelectorAll('p'))
        .map(p => (p.textContent || '').trim())
        .filter(Boolean);
};

export const AboutPopup: React.FC<AboutPopupProps> = ({
    isOpen,
    onClose,
    version,
    isLoadingVersion,
    errorVersion,
    onRetryVersion,
}) => {
    // Index into the version history; the most recent past entry starts open.
    const [openIndex, setOpenIndex] = useState<number>(0);

    // 日志优先读外部 changelog.json（改完推送即可生效），全部失败时回退内置数据
    const { logs, notice, sourceLabel, error: changelogError, reload } = useChangelog();

    const parsed = logs.map(log => ({ date: log.date, items: parseLogItems(log.content) }));
    const latest = parsed[0];
    const history = parsed.slice(1);

    if (!isOpen) return null;

    return (
        <DialogFrame onClose={onClose} labelledBy="about-title" className="w-full max-w-[680px] max-h-[min(660px,calc(100dvh-32px))]">
            <div className="flex-none flex items-start justify-between gap-6 max-md:gap-4 px-6 max-md:px-5 pt-[22px] pb-5 border-b border-white/[.06]">
                <div className="flex flex-col gap-2">
                    <Eyebrow>关于本项目</Eyebrow>
                    <h2 id="about-title" className="text-[21px] font-semibold leading-[1.25] text-slate-100">Phigros 谱面下载器</h2>
                    <p className="text-sm leading-[1.6] text-slate-400 text-pretty">{projectDescription}</p>
                    <p className="text-[12px] leading-[1.6] text-slate-500 text-pretty">
                        本站为二次开发版本：新增答题鉴权、加速源切换、分享卡片、批量下载等。与 Phigros 官方及南京鸽游网络有限公司无授权、合作或运营关系。
                    </p>
                </div>
                <CloseButton onClick={onClose} />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto thin-scroll px-6 max-md:px-5 py-5 flex flex-col gap-5">
                <VersionCard
                    isLoading={isLoadingVersion}
                    error={errorVersion}
                    version={version}
                    onRetry={onRetryVersion}
                />

                {notice && (
                    <div className="rounded-xl border border-[rgba(251,191,36,.28)] bg-[rgba(251,191,36,.06)] px-[18px] py-3.5">
                        <span className="font-mono text-[10px] font-semibold tracking-[.12em] text-[#fbbf24]">公告</span>
                        <p className="m-0 mt-1.5 text-[13px] leading-[1.6] text-slate-300">{notice}</p>
                    </div>
                )}

                {latest && (
                    <div className="rounded-xl border border-[rgba(34,211,238,.22)] bg-[rgba(34,211,238,.04)] px-[18px] py-4 flex flex-col gap-2.5">
                        <div className="flex items-center gap-2.5">
                            <span className="font-mono text-[10px] font-semibold tracking-[.12em] text-[#06141a] bg-[#22d3ee] px-[7px] py-[3px] rounded">最新</span>
                            <span className="font-mono text-[13px] font-medium text-slate-200">{latest.date}</span>
                        </div>
                        <ul className="flex flex-col gap-1.5">
                            {latest.items.map(item => (
                                <li key={item} className="flex gap-2.5 text-sm leading-[1.5] text-slate-300">
                                    <span className="text-[#22d3ee]">—</span><span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {history.length > 0 && (
                    <div className="flex flex-col">
                        <span className="font-mono text-[10px] font-medium tracking-[.14em] text-slate-500 pb-2">历史更新</span>
                        {history.map((log, i) => {
                            const isOpenItem = openIndex === i;
                            return (
                                <div key={`${log.date}-${i}`} className="border-t border-white/[.06]">
                                    <button
                                        type="button"
                                        onClick={() => setOpenIndex(isOpenItem ? -1 : i)}
                                        aria-expanded={isOpenItem}
                                        className="w-full h-[46px] flex items-center justify-between group"
                                    >
                                        <span className="flex items-center gap-3">
                                            <span className={`font-mono text-[13px] font-medium ${isOpenItem ? 'text-slate-100' : 'text-slate-300 group-hover:text-white'}`}>{log.date}</span>
                                            <span className="text-xs text-slate-600">{log.items.length} 项</span>
                                        </span>
                                        <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpenItem ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isOpenItem && (
                                        <ul className="pb-3.5 flex flex-col gap-1.5">
                                            {log.items.map(item => (
                                                <li key={item} className="flex gap-2.5 text-[13px] leading-[1.5] text-slate-400">
                                                    <span className="text-slate-600">—</span><span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {(changelogError || sourceLabel) && (
                    <div className="flex items-center justify-between gap-3 text-[12px] text-slate-500">
                        <span>{changelogError || (sourceLabel ? `日志来源：${sourceLabel}` : '')}</span>
                        <button type="button" onClick={reload} className="font-semibold text-[#22d3ee] hover:text-[#67e8f9]">重新加载</button>
                    </div>
                )}
            </div>

            <DialogFooter>
                <span className="text-[13px] text-slate-500">
                    上游项目 <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[#22d3ee] hover:text-[#67e8f9]">swordalt/phigros-chart-downloader</a>
                    <span className="hidden sm:inline"> · 本站 <a href={SITE_URL} target="_blank" rel="noreferrer" className="text-[#22d3ee] hover:text-[#67e8f9]">riluo-ya/pcd</a></span>
                </span>
                <Button variant="outline" size="md" onClick={onClose}>关闭</Button>
            </DialogFooter>
        </DialogFrame>
    );
};
