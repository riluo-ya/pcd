
import React from 'react';

interface InstructionPopupProps {
    isOpen: boolean;
    onConfirm: () => void;
}

export const InstructionPopup: React.FC<InstructionPopupProps> = ({ isOpen, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div 
            className="motion-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            aria-labelledby="instruction-title"
            role="dialog"
            aria-modal="true"
        >
            <div className="motion-dialog relative w-full max-w-lg mx-auto overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-6 text-left transform transition-all">
                <h2 id="instruction-title" className="text-2xl font-bold text-brand-cyan mb-4">
                    请阅读此内容
                </h2>
                <div className="text-slate-300 space-y-3">
                    <p>
                        大多数现代 Phigros 模拟器已不再跟上官方 Phigros 文件格式，因此你在游玩时会遇到视觉 bug。
                    </p>
                    <ol className="list-decimal list-inside space-y-2 pl-2">
                        <li>要游玩此谱面，请将其导入 <b>Phira</b> 或 <b>phi-sim</b>。</li>
                        <li>该文件也可以使用「导入 PEZ」按钮直接导入 <b>Re:PhiEdit</b>。</li>
                    </ol>
                    <p className="mt-4 text-sm text-slate-400">
                        此消息仅显示一次。
                    </p>
                </div>
                <div className="mt-6 text-right">
                    <button
                        onClick={onConfirm}
                        className="px-6 py-2 font-bold rounded-lg shadow-md transition-colors duration-200 bg-purple-800 hover:bg-purple-900 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-purple-500"
                    >
                        继续下载
                    </button>
                </div>
            </div>
        </div>
    );
};
