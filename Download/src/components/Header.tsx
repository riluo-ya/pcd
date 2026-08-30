
import React, { memo } from 'react';

interface HeaderProps {
    onSettingsClick: () => void;
    onFaqClick: () => void;
    onAboutClick: () => void;
}

export const Header: React.FC<HeaderProps> = memo(({ onSettingsClick, onFaqClick, onAboutClick }) => {
    return (
        <header className="relative text-center group flex flex-col items-center gap-6">
            
            {/* Title & Subtitle Area */}
            <div className="relative z-10 flex flex-col items-center gap-3">
                <div className="flex items-center justify-center gap-4">
                     <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-200 via-slate-300 to-slate-400 drop-shadow-sm px-2">
                        Phigros 谱面下载器
                    </h1>
                </div>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                    - 使用前请先阅读「常见问题」和「设置」页面！ -
                </p>
            </div>

            {/* Buttons Area */}
            <div className="flex flex-wrap justify-center gap-4 z-20">
                <button 
                    type="button"
                    onClick={onAboutClick}
                    className="px-4 py-2 font-semibold rounded-lg shadow-md transition-colors duration-200 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                    关于
                </button>
                <button 
                    type="button"
                    onClick={onFaqClick}
                    className="px-4 py-2 font-semibold rounded-lg shadow-md transition-colors duration-200 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                    常见问题
                </button>
                <button 
                    type="button"
                    onClick={onSettingsClick}
                    className="px-4 py-2 font-semibold rounded-lg shadow-md transition-colors duration-200 bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                    设置
                </button>
            </div>
        </header>
    );
});
