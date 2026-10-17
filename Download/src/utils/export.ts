
import FileSaver from 'file-saver';
import { FileInfo, Song } from '../types';
import { Settings } from '../defaultSettings';
import { sendAllAssetsDownloadNotification, sendChartDownloadNotification } from './api';
import { ProxySource } from './resourceUrls';
import { getGithubToken } from './githubAuth';
import type { BulkPackaging, FailedFile } from '../worker/export.worker';

// Worker interface (matching the worker definition)
interface WorkerResponse {
    type: 'progress' | 'bulkProgress' | 'complete' | 'error';
    progress?: number;
    currentFile?: string;
    action?: 'Downloading' | 'Zipping' | 'Waiting';
    songsLeft?: number;
    percent?: number;
    blob?: Blob;
    fileName?: string;
    chartId?: string;
    failedFiles?: FailedFile[];
    error?: string;
}

type ExportMessage =
    | { type: 'exportAllAssets'; files: FileInfo[]; selectedSong: Song; githubToken?: string }
    | { type: 'exportChart'; files: FileInfo[]; selectedSong: Song; selectedDifficulty: string | null; difficulties?: string[]; settings: Settings; githubToken?: string }
    | { type: 'exportBulkAssets'; songs: Song[]; delaySeconds: number; proxySource: ProxySource; fileName?: string; difficultyScope?: string[] | null; packaging?: BulkPackaging; settings?: Settings; githubToken?: string };

const runWorker = (
    message: ExportMessage, 
    onProgress?: (progress: number) => void,
    onBulkProgress?: (currentFile: string, action: 'Downloading' | 'Zipping' | 'Waiting', songsLeft: number, percent?: number) => void,
    signal?: AbortSignal
): Promise<{ blob: Blob, fileName: string, chartId?: string, failedFiles?: FailedFile[] }> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../worker/export.worker.ts', import.meta.url), { type: 'module' });

        const onAbort = () => {
            worker.terminate();
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
        };

        if (signal) {
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener('abort', onAbort);
        }

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const { type, progress, currentFile, action, songsLeft, percent, blob, fileName, chartId, failedFiles, error } = event.data;

            if (type === 'progress' && progress !== undefined && onProgress) {
                onProgress(progress);
            } else if (type === 'bulkProgress' && currentFile && action && songsLeft !== undefined && onBulkProgress) {
                onBulkProgress(currentFile, action, songsLeft, percent);
            } else if (type === 'complete' && blob && fileName) {
                if (signal) signal.removeEventListener('abort', onAbort);
                resolve({ blob, fileName, chartId, failedFiles });
                worker.terminate();
            } else if (type === 'error') {
                if (signal) signal.removeEventListener('abort', onAbort);
                reject(new Error(error || '导出线程出现未知错误'));
                worker.terminate();
            }
        };

        worker.onerror = (error) => {
            if (signal) signal.removeEventListener('abort', onAbort);
            reject(error);
            worker.terminate();
        };

        worker.postMessage({ ...message, githubToken: getGithubToken() });
    });
};

export const exportAllAssets = async (
    files: FileInfo[], 
    selectedSong: Song, 
    settings: Settings,
    onProgress: (progress: number) => void
): Promise<string> => {
    try {
        const { blob, fileName } = await runWorker({
            type: 'exportAllAssets',
            files,
            selectedSong
        }, onProgress);

        FileSaver.saveAs(blob, fileName);

        sendAllAssetsDownloadNotification(selectedSong.name, selectedSong.id, settings.analyticsEnabled);
        return fileName;
    } catch (error) {
        console.error("导出失败：", error);
        throw error;
    }
};

export const exportChart = async (
    files: FileInfo[],
    selectedSong: Song,
    selectedDifficulty: string | null,
    settings: Settings,
    onProgress: (progress: number) => void,
    /** 未指定难度时导出这些难度；留空则由 Worker 按曲目元数据推断 */
    difficulties?: string[]
): Promise<string> => {
    try {
        const { blob, fileName, chartId } = await runWorker({
            type: 'exportChart',
            files,
            selectedSong,
            selectedDifficulty,
            difficulties,
            settings
        }, onProgress);

        FileSaver.saveAs(blob, fileName);

        sendChartDownloadNotification(selectedSong.name, selectedDifficulty ?? 'ALL', chartId || 'Unknown', settings.analyticsEnabled);
        return fileName;
    } catch (error) {
        console.error("导出失败：", error);
        throw error;
    }
};

export const exportBulkAssets = async (
    songs: Song[],
    delaySeconds: number,
    proxySource: ProxySource,
    onBulkProgress: (currentFile: string, action: 'Downloading' | 'Zipping' | 'Waiting', songsLeft: number, percent?: number) => void,
    signal?: AbortSignal,
    /** 自定义输出文件名（分卷导出时用于带上 01-of-03 之类的后缀） */
    fileName?: string,
    /** 只导出这些难度；null / 空数组 = 每首歌的全部难度 */
    difficultyScope?: string[] | null,
    /** per-difficulty：每个难度一个谱面包；raw：资源平铺 + charts/*.json，体积更小 */
    packaging: BulkPackaging = 'per-difficulty',
    settings?: Settings
): Promise<FailedFile[]> => {
    try {
        const { blob, fileName: outName, failedFiles } = await runWorker({
            type: 'exportBulkAssets',
            songs,
            delaySeconds,
            proxySource,
            fileName,
            difficultyScope,
            packaging,
            settings
        }, undefined, onBulkProgress, signal);

        FileSaver.saveAs(blob, outName);
        return failedFiles ?? [];
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.log("批量导出已取消。");
            return [];
        }
        console.error("批量导出失败：", error);
        throw error;
    }
};
