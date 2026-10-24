import React, { useEffect } from 'react';

/**
 * 自绘弹窗系统。
 *
 * 之前出错一律走 `window.alert` / `window.confirm` —— 浏览器原生弹窗是块
 * 白底系统控件，跟深色界面完全不搭，手机上还会把整个页面卡住。
 * 这里按上游的设计语言做一套自绘版本：深色玻璃面板 + 顶部细色调线 +
 * 等宽小标签（Eyebrow）+ 手机端底部抽屉。
 */

export type Tone = 'info' | 'warning' | 'error';

const TOPLINE: Record<Tone, string> = {
    info: 'linear-gradient(90deg, transparent, rgba(34,211,238,.7), transparent)',
    warning: 'linear-gradient(90deg, transparent, rgba(251,191,36,.8), transparent)',
    error: 'linear-gradient(90deg, transparent, rgba(248,113,113,.8), transparent)',
};

const EYEBROW_COLOR: Record<Tone, string> = {
    info: 'text-[#22d3ee]',
    warning: 'text-[#fbbf24]',
    error: 'text-[#f87171]',
};

const MOBILE_PANEL: Record<'sheet' | 'panel', string> = {
    sheet: 'max-md:w-full max-md:max-w-none max-md:max-h-[86dvh] max-md:rounded-b-none max-md:rounded-t-[22px] max-md:border-b-0',
    panel: 'max-md:w-full max-md:max-w-none max-md:h-[calc(100dvh-10px)] max-md:max-h-none max-md:rounded-b-none max-md:border-b-0',
};

interface DialogFrameProps {
    onClose: () => void;
    /** 点遮罩是否关闭。Escape 总是会关闭。 */
    closeOnBackdrop?: boolean;
    tone?: Tone;
    labelledBy?: string;
    role?: 'dialog' | 'alertdialog';
    /** 手机端呈现方式：贴合内容的底部抽屉，或接近全高的面板 */
    mobile?: 'sheet' | 'panel';
    className?: string;
    children: React.ReactNode;
}

/** 暗化模糊遮罩 + 共用的深色玻璃面板，顶部一条细色调线 */
export const DialogFrame: React.FC<DialogFrameProps> = ({
    onClose,
    closeOnBackdrop = true,
    tone = 'info',
    labelledBy,
    role = 'dialog',
    mobile = 'panel',
    className = '',
    children,
}) => {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return (
        <div
            className="motion-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4 max-md:p-0 max-md:items-end bg-[rgba(4,6,10,.78)] backdrop-blur-[6px]"
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            onClick={closeOnBackdrop ? onClose : undefined}
        >
            <div
                className={`motion-dialog relative flex flex-col overflow-hidden rounded-2xl border border-white/[.08] bg-[rgba(12,15,22,.97)] shadow-[0_40px_120px_rgba(0,0,0,.6)] ${className} ${MOBILE_PANEL[mobile]}`}
                onClick={e => e.stopPropagation()}
            >
                <div className="dialog-topline" style={{ background: TOPLINE[tone] }} />
                {mobile === 'sheet' && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="md:hidden flex-none -mt-1 -mb-1 h-[22px] flex items-center justify-center"
                    >
                        <span className="w-9 h-1 rounded-sm bg-white/[.18]" />
                    </button>
                )}
                {children}
            </div>
        </div>
    );
};

export const Eyebrow: React.FC<{ tone?: Tone; className?: string; children: React.ReactNode }> = ({
    tone = 'info',
    className = '',
    children,
}) => (
    <span
        className={`flex items-center gap-2 font-mono text-[10px] font-medium tracking-[.16em] uppercase ${EYEBROW_COLOR[tone]} ${className}`}
    >
        {children}
    </span>
);

export const CloseButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label="Close"
        className="flex-none w-[34px] h-[34px] max-md:w-11 max-md:h-11 max-md:-mr-1.5 max-md:rounded-[10px] rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[.06] hover:text-slate-200 transition-colors"
    >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>
);

/** 大弹窗（设置 / 关于）用的 68px 头部 */
export const DialogHeader: React.FC<{
    id?: string;
    eyebrow: React.ReactNode;
    title: React.ReactNode;
    onClose: () => void;
}> = ({ id, eyebrow, title, onClose }) => (
    <div className="h-[68px] flex-none flex items-center justify-between gap-3 px-6 max-md:px-5 border-b border-white/[.06]">
        <div className="flex flex-col">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2 id={id} className="text-[21px] font-semibold leading-[1.25] text-slate-100">
                {title}
            </h2>
        </div>
        <CloseButton onClick={onClose} />
    </div>
);

type ButtonVariant = 'primary' | 'warning' | 'danger' | 'outline' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-[#22d3ee] hover:bg-[#67e8f9] text-[#06141a] font-bold',
    warning: 'bg-[#fbbf24] hover:bg-[#fcd34d] text-[#1a1204] font-bold',
    danger: 'bg-[#f87171] hover:bg-[#fca5a5] text-[#1a0a0a] font-bold',
    outline: 'border border-white/[.12] hover:bg-white/[.05] text-slate-200 font-semibold',
    ghost: 'text-slate-400 hover:text-white font-semibold',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
}

export const Button: React.FC<ButtonProps> = ({ variant = 'outline', size = 'sm', className = '', ...props }) => {
    const sizing =
        size === 'md'
            ? 'px-[22px] py-[9px] text-sm rounded-[9px]'
            : variant === 'ghost'
              ? 'px-2.5 py-2 text-[13px] rounded-lg'
              : 'px-3.5 py-2 text-[13px] rounded-lg';
    return (
        <button
            type="button"
            className={`transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
            {...props}
        />
    );
};

const iconProps = {
    width: 14,
    height: 14,
    fill: 'none',
    viewBox: '0 0 24 24',
    strokeWidth: 2,
    stroke: 'currentColor',
} as const;

export const InfoGlyph = () => (
    <svg {...iconProps}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
    </svg>
);

export const WarningGlyph = () => (
    <svg {...iconProps}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
    </svg>
);

export const ErrorGlyph = () => (
    <svg {...iconProps}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
    </svg>
);

const GLYPH: Record<Tone, () => React.JSX.Element> = {
    info: InfoGlyph,
    warning: WarningGlyph,
    error: ErrorGlyph,
};

interface NoticeDialogProps {
    tone: Tone;
    eyebrow: string;
    title: string;
    onClose: () => void;
    /** 显示在左下角的小字，如"仅本次显示" */
    footnote?: string;
    actions: React.ReactNode;
    children: React.ReactNode;
}

/**
 * 紧凑的通知框（信息 / 警告 / 错误）。
 * 只有纯信息类的允许点遮罩关闭 —— 错误和警告需要用户明确确认，避免误触关掉。
 */
export const NoticeDialog: React.FC<NoticeDialogProps> = ({
    tone,
    eyebrow,
    title,
    onClose,
    footnote,
    actions,
    children,
}) => {
    const titleId = `notice-${eyebrow.toLowerCase().replace(/\s+/g, '-')}`;
    const Glyph = GLYPH[tone];
    return (
        <DialogFrame
            onClose={onClose}
            tone={tone}
            closeOnBackdrop={tone === 'info'}
            role={tone === 'info' ? 'dialog' : 'alertdialog'}
            labelledBy={titleId}
            mobile="sheet"
            className="w-full max-w-[440px] gap-3.5 px-[22px] pt-[22px] pb-[18px] max-md:px-5 max-md:pt-1 max-md:pb-[calc(24px+env(safe-area-inset-bottom))] max-md:overflow-y-auto shadow-[0_30px_80px_rgba(0,0,0,.5)]"
        >
            <Eyebrow tone={tone} className="tracking-[.14em]">
                <Glyph />
                {eyebrow}
            </Eyebrow>
            <h2 id={titleId} className="text-[19px] max-md:text-[21px] font-semibold leading-[1.3] text-slate-100">
                {title}
            </h2>
            {children}
            <div
                className={`flex flex-wrap items-center gap-2 pt-1 max-md:flex-col-reverse max-md:items-stretch max-md:gap-3.5 ${footnote ? 'justify-between' : 'justify-end'}`}
            >
                {footnote && (
                    <span className="font-mono text-[10px] font-medium tracking-[.08em] uppercase text-slate-600 max-md:text-center">
                        {footnote}
                    </span>
                )}
                <div className="flex flex-wrap items-center justify-end gap-2 max-md:flex-col-reverse max-md:items-stretch max-md:gap-2.5 max-md:[&>button]:h-[52px] max-md:[&>button]:rounded-xl max-md:[&>button]:text-[15px]">
                    {actions}
                </div>
            </div>
        </DialogFrame>
    );
};

/** 错误提示的正文：正文 + 可折叠的技术细节（替代"请查看控制台"） */
export const ErrorBody: React.FC<{ message: string; detail?: string | null }> = ({ message, detail }) => {
    const [open, setOpen] = React.useState(false);
    return (
        <div className="flex flex-col gap-2">
            <p className="text-[13px] leading-[1.6] text-slate-300">{message}</p>
            {detail && (
                <>
                    <button
                        type="button"
                        onClick={() => setOpen(v => !v)}
                        className="self-start font-mono text-[10px] tracking-[.08em] uppercase text-slate-500 hover:text-slate-300 transition-colors"
                    >
                        {open ? '▾ 技术细节' : '▸ 技术细节'}
                    </button>
                    {open && (
                        <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 border border-white/[.06] p-3 text-[11px] leading-[1.5] text-slate-400 whitespace-pre-wrap break-all">
                            {detail}
                        </pre>
                    )}
                </>
            )}
        </div>
    );
};

/**
 * 确认框（替代 window.confirm）。
 * 返回 boolean 的 Promise，用法见 useConfirm。
 */
export const ConfirmDialog: React.FC<{
    tone?: Tone;
    eyebrow: string;
    title: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    children: React.ReactNode;
}> = ({
    tone = 'warning',
    eyebrow,
    title,
    confirmLabel = '确定',
    cancelLabel = '取消',
    onConfirm,
    onCancel,
    children,
}) => (
    <NoticeDialog
        tone={tone}
        eyebrow={eyebrow}
        title={title}
        onClose={onCancel}
        actions={
            <>
                <Button variant="ghost" onClick={onCancel}>
                    {cancelLabel}
                </Button>
                <Button variant={tone === 'error' ? 'danger' : tone === 'warning' ? 'warning' : 'primary'} onClick={onConfirm}>
                    {confirmLabel}
                </Button>
            </>
        }
    >
        {children}
    </NoticeDialog>
);
