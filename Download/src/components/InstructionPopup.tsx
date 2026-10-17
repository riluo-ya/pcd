import React from 'react';
import { Button, InfoGlyph, NoticeDialog } from './ui/Dialog';

interface InstructionPopupProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const InstructionPopup: React.FC<InstructionPopupProps> = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <NoticeDialog
            tone="info"
            icon={<InfoGlyph />}
            eyebrow="下载之后"
            title="这个文件怎么用"
            onClose={onCancel}
            footnote="只提示一次"
            actions={<Button variant="primary" onClick={onConfirm}>继续下载</Button>}
        >
            <div className="flex flex-col gap-2 max-md:gap-2.5">
                <div className="grid grid-cols-[22px_1fr] max-md:grid-cols-[24px_1fr] gap-2 text-[13px] max-md:text-sm leading-[1.5] text-slate-300">
                    <span className="font-mono text-[11px] leading-[1.8] font-medium text-[#22d3ee]">01</span>
                    <span>在 <b className="text-white">Phira</b> 里点 + 号导入它。</span>
                </div>
                <div className="grid grid-cols-[22px_1fr] max-md:grid-cols-[24px_1fr] gap-2 text-[13px] max-md:text-sm leading-[1.5] text-slate-300">
                    <span className="font-mono text-[11px] leading-[1.8] font-medium text-[#22d3ee]">02</span>
                    <span>或者在 <b className="text-white">Re:PhiEdit</b> 里用「导入 PEZ」来编辑。</span>
                </div>
            </div>
        </NoticeDialog>
    );
};
