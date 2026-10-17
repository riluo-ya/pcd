import React from 'react';
import { Button, InfoGlyph, NoticeDialog } from './ui/Dialog';

interface AssetDownloadWarningPopupProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const AssetDownloadWarningPopup: React.FC<AssetDownloadWarningPopupProps> = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <NoticeDialog
            tone="info"
            icon={<InfoGlyph />}
            eyebrow="原始文件"
            title="这是谱面 .json，不是可直接游玩的谱面"
            onClose={onCancel}
            footnote="只提示一次"
            actions={
                <>
                    <Button variant="outline" onClick={onCancel}>取消</Button>
                    <Button variant="primary" onClick={onConfirm}>下载 .json</Button>
                </>
            }
        >
            <p className="text-[13px] leading-[1.6] text-slate-400 text-pretty">
                它本身不能直接导入 Phira 或 RPE。想要可直接游玩的文件，请选好难度后用{' '}
                <b className="text-[#22d3ee] font-semibold">「导出谱面」</b>。
            </p>
        </NoticeDialog>
    );
};
