import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CheckIcon, XMarkIcon } from './Icons';
import { NameOption, filterNameOptions, resolveNameCommit } from '../utils/bulkFilters';

interface NameComboboxProps {
    /** 输入框为空时的占位文案，如「全部谱师」 */
    placeholder: string;
    /** 候选列表（已按作品数降序） */
    options: NameOption[];
    /** 当前选中的名字，空字符串表示未选 */
    value: string;
    onChange: (v: string) => void;
}

/**
 * 可输入也可选择的名称选择器。
 *
 * 不用原生 <select>，因为浏览器自己画的下拉面板和站点深色风格对不上。
 * 这里展开的是一个占据文档流的列表块（而不是绝对定位的浮层）——
 * 筛选面板本身有 overflow 裁剪，浮层会被切掉，推进文档流才不会。
 *
 * 匹配规则：输入时做「包含」匹配方便找人；真正生效的筛选仍用完全匹配，
 * 保证选中的谱师精确对应一个人，不会因为子串误命中把别人的曲子算进来。
 */
export const NameCombobox: React.FC<NameComboboxProps> = ({ placeholder, options, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value);
    const [highlight, setHighlight] = useState(0);
    const wrapRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // 外部改变选中值（比如点「清除」）时同步输入框
    useEffect(() => {
        setDraft(value);
    }, [value]);

    // 过滤与排序规则在 bulkFilters 里，单独有测试覆盖
    const { list: candidates, total: totalMatched } = useMemo(
        () => filterNameOptions(options, draft),
        [options, draft]
    );

    // 点击外部关闭
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                commitDraft();
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open, draft, options]);

    useEffect(() => {
        if (open) setHighlight(0);
    }, [open, draft]);

    /** 失焦或关闭时确认输入：精确命中候选才生效，否则回退到已选值 */
    const commitDraft = () => {
        const next = resolveNameCommit(options, draft, value);
        onChange(next);
        setDraft(next);
    };

    const pick = (name: string) => {
        onChange(name);
        setDraft(name);
        setOpen(false);
    };

    const clear = () => {
        onChange('');
        setDraft('');
        setOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) { setOpen(true); return; }
            setHighlight(h => Math.min(h + 1, candidates.length - 1));
            scrollToHighlight(Math.min(highlight + 1, candidates.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
            scrollToHighlight(Math.max(highlight - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && candidates[highlight]) {
                pick(candidates[highlight].name);
            } else if (!open) {
                setOpen(true);
            }
        } else if (e.key === 'Escape') {
            if (open) {
                e.stopPropagation(); // 别让外层把整个筛选面板关了
                setOpen(false);
                setDraft(value);
            }
        }
    };

    const scrollToHighlight = (idx: number) => {
        requestAnimationFrame(() => {
            const el = listRef.current?.children[idx] as HTMLElement | undefined;
            el?.scrollIntoView({ block: 'nearest' });
        });
    };

    return (
        <div ref={wrapRef} className="relative">
            <div className="relative">
                <input
                    type="text"
                    value={draft}
                    placeholder={placeholder}
                    onChange={e => { setDraft(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => { if (!open) commitDraft(); }}
                    onKeyDown={onKeyDown}
                    autoComplete="off"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2 pr-14 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-cyan"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-0.5">
                    {value && (
                        <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); clear(); }}
                            className="p-1 text-slate-500 hover:text-slate-300"
                            aria-label="清除"
                        >
                            <XMarkIcon className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); if (open) { commitDraft(); } setOpen(!open); }}
                        className="p-1 text-slate-500 hover:text-slate-300"
                        aria-label={open ? '收起列表' : '展开列表'}
                        aria-expanded={open}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                            strokeWidth={1.5} stroke="currentColor"
                            className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </button>
                </div>
            </div>

            {open && (
                <div
                    ref={listRef}
                    className="mt-1 max-h-40 overflow-y-auto custom-scrollbar rounded-lg border border-slate-700 bg-slate-900/95"
                    role="listbox"
                >
                    {candidates.length > 0 ? (
                        <>
                            {candidates.map((o, i) => {
                                const active = o.name === value;
                                return (
                                    <div
                                        key={o.name}
                                        role="option"
                                        aria-selected={active}
                                        onMouseDown={e => { e.preventDefault(); pick(o.name); }}
                                        onMouseEnter={() => setHighlight(i)}
                                        className={`flex items-center justify-between px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                                            i === highlight ? 'bg-brand-cyan/20 text-white' : 'text-slate-300'
                                        }`}
                                    >
                                        <span className="truncate">{o.name}</span>
                                        <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                                            <span className="text-[11px] text-slate-500">{o.count}</span>
                                            {active && <CheckIcon className="w-3.5 h-3.5 text-brand-cyan" />}
                                        </span>
                                    </div>
                                );
                            })}
                            {totalMatched > candidates.length && (
                                <div className="px-2 py-1.5 text-[11px] text-slate-600 border-t border-slate-700">
                                    还有 {totalMatched - candidates.length} 个未显示，继续输入可缩小范围
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="px-2 py-3 text-center text-xs text-slate-500">
                            没有匹配的名称
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
