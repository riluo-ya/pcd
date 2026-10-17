import { ProxySource } from './utils/resourceUrls';

export interface Settings {
    useZipFormat: boolean;
    includeInfoYml: boolean;
    analyticsEnabled: boolean;
    exportIllustrationType: 'full' | 'blur';
    chartFormatConversion: 'none' | 'rpe';
    chartEasingFitting: boolean;
    useNewUi: boolean;
    proxySource: ProxySource;
    githubToken: string;
    // New UI Sub-settings
    newUiAudioPreview: boolean;
    newUiAudioVolume: number;
    newUiLoopAudio: boolean;
    newUiAutoplayAudio: boolean;
    newUiBlur: boolean;
    newUiShowVisualizer: boolean;
    newUiVisualizerColor: string;
    newUiVisualizerHeight: number;
    newUiVisualizerOpacity: number;
    newUiSongSpecificEffects: boolean;
    bulkDownloadMode: boolean;
    advancedInfo: boolean;
    // 分享卡片
    shareCardEnabled: boolean;
    shareCardBpm: boolean;
    shareCardJudgeLines: boolean;
    shareCardDuration: boolean;
    shareCardNoteCounts: boolean;
}

export const defaultSettings: Settings = {
    useZipFormat: false,
    includeInfoYml: true,
    analyticsEnabled: true,
    exportIllustrationType: 'full',
    chartFormatConversion: 'none',
    chartEasingFitting: true,
    useNewUi: true,
    proxySource: 'github',
    githubToken: '',
    newUiAudioPreview: true,
    newUiAudioVolume: 1,
    newUiLoopAudio: true,
    newUiAutoplayAudio: false,
    newUiBlur: false,
    newUiShowVisualizer: true,
    newUiVisualizerColor: 'gray',
    newUiVisualizerHeight: 60,
    newUiVisualizerOpacity: 60,
    newUiSongSpecificEffects: false,
    bulkDownloadMode: false,
    advancedInfo: false,
    shareCardEnabled: true,
    shareCardBpm: true,
    shareCardJudgeLines: true,
    shareCardDuration: true,
    shareCardNoteCounts: true,
};
