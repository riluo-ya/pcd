
export interface Settings {
    useZipFormat: boolean;
    includeInfoYml: boolean;
    disableDiscordNotifications: boolean;
    exportIllustrationType: 'full' | 'blur';
    useNewUi: boolean;
    // New UI Sub-settings
    newUiAudioPreview: boolean;
    newUiAudioVolume: number;
    newUiLoopAudio: boolean;
    newUiShowVisualizer: boolean;
    newUiVisualizerColor: string;
    newUiVisualizerHeight: number;
    newUiVisualizerOpacity: number;
    newUiSongSpecificEffects: boolean;
    bulkDownloadMode: boolean;
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
    disableDiscordNotifications: false,
    exportIllustrationType: 'full',
    useNewUi: true,
    newUiAudioPreview: false,
    newUiAudioVolume: 1,
    newUiLoopAudio: true,
    newUiShowVisualizer: true,
    newUiVisualizerColor: 'gray', // slate-200
    newUiVisualizerHeight: 60,
    newUiVisualizerOpacity: 60,
    newUiSongSpecificEffects: false,
    bulkDownloadMode: false,
    shareCardEnabled: true,
    shareCardBpm: true,
    shareCardJudgeLines: true,
    shareCardDuration: true,
    shareCardNoteCounts: true,
};
