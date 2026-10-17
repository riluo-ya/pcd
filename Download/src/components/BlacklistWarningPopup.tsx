import React from 'react';
import { Button, NoticeDialog, WarningGlyph } from './ui/Dialog';

interface BlacklistWarningPopupProps {
    isOpen: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    reason?: string;
}

export const BlacklistWarningPopup: React.FC<BlacklistWarningPopupProps> = ({ isOpen, onCancel, onConfirm, reason }) => {
    if (!isOpen) return null;

    return (
        <NoticeDialog
            tone="warning"
            icon={<WarningGlyph />}
            eyebrow="已知问题"
            title="这个谱面可能无法正常工作"
            onClose={onCancel}
            actions={
                <>
                    <Button variant="outline" onClick={onCancel}>取消</Button>
                    <Button variant="warning" onClick={onConfirm}>仍然继续</Button>
                </>
            }
        >
            {reason && (
                <div className="flex flex-col gap-1 px-3 py-2.5 rounded-lg bg-[rgba(251,191,36,.05)] border border-[rgba(251,191,36,.15)]">
                    <span className="font-mono text-[10px] font-medium tracking-[.12em] text-[#a16207]">原因</span>
                    <span className="text-[13px] leading-[1.55] text-slate-200">{reason}</span>
                </div>
            )}
            <p className="text-[13px] text-slate-400">仍然要继续下载吗？</p>
        </NoticeDialog>
    );
};
