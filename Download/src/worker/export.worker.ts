import JSZip from 'jszip';
import { FileInfo, Song } from '../types';
import { Settings } from '../defaultSettings';
import { ghRaw } from '../utils/sources';

// Define message types for type safety
export type ExportMessage =
    | { type: 'exportAllAssets'; files: FileInfo[]; selectedSong: Song }
    | { type: 'exportChart'; files: FileInfo[]; selectedSong: Song; selectedDifficulty: string | null; difficulties?: string[]; settings: Settings }
    | { type: 'exportBulkAssets'; songs: Song[]; delaySeconds: number; difficultyScope?: string[] | null };

export type WorkerResponse =
    | { type: 'progress'; progress: number }
    | { type: 'bulkProgress'; currentFile: string; action: 'Downloading' | 'Zipping' | 'Waiting'; songsLeft: number; percent?: number }
    | { type: 'complete'; blob: Blob; fileName: string; chartId?: string; failedFiles?: FailedFile[] }
    | { type: 'error'; error: string };

/** 单个文件下载失败的记录，供调用方提示与重试 */
export interface FailedFile {
    songId: string;
    songName: string;
    fileType: string;
    url: string;
}

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = async (event: MessageEvent<ExportMessage>) => {
    const { type } = event.data;

    try {
        if (type === 'exportAllAssets') {
            await handleExportAllAssets(event.data.files, event.data.selectedSong);
        } else if (type === 'exportChart') {
            await handleExportChart(
                event.data.files,
                event.data.selectedSong,
                event.data.selectedDifficulty,
                event.data.settings,
                event.data.difficulties
            );
        } else if (type === 'exportBulkAssets') {
            await handleExportBulkAssets(event.data.songs, event.data.delaySeconds, event.data.difficultyScope ?? null);
        }
    } catch (error) {
        ctx.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    }
};


const ALL_DIFFS = ['EZ', 'HD', 'IN', 'AT'];

/**
 * 判断某难度是否真实存在。
 * difficulty.tsv 里缺列、空串、—、-、?、∅ 都算「没有」；0 也不算有效定数。
 */
function hasDifficulty(song: Song, diff: string): boolean {
    const raw = song.difficulties?.[diff as keyof NonNullable<Song['difficulties']>];
    if (!raw) return false;
    const v = String(raw).trim();
    if (!v || v === '—' || v === '-' || v === '?' || v === '∅') return false;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0;
}

/**
 * 该曲目实际拥有的难度列表。
 * 难度表整份缺失时退回全 4 个 —— 拿不到数据就照旧靠 404 兜底，
 * 总比一首歌一个谱面都不下要好。
 */
function actualDifficulties(song: Song): string[] {
    const has = ALL_DIFFS.filter(d => hasDifficulty(song, d));
    return has.length > 0 ? has : [...ALL_DIFFS];
}

/** 按用户指定的范围收窄：没指定或指定了空数组就用曲目实际拥有的 */
function resolveDifficulties(song: Song, scope: string[] | null): string[] {
    const actual = actualDifficulties(song);
    if (!scope || scope.length === 0) return actual;
    const picked = ALL_DIFFS.filter(d => scope.includes(d) && actual.includes(d));
    // 用户勾的难度这首歌一个都没有时，退回实际拥有的，避免导出空包
    return picked.length > 0 ? picked : actual;
}

const handleExportAllAssets = async (files: FileInfo[], selectedSong: Song) => {
    const zip = new JSZip();
    const chartsFolder = zip.folder('charts');
    if (!chartsFolder) throw new Error("Could not create 'charts' folder in zip.");

    const filePromises = files.map(file =>
        fetch(file.url, { referrerPolicy: 'no-referrer' }).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch ${file.url}: ${res.statusText}`);
            return res.blob();
        })
    );

    const blobs = await Promise.all(filePromises);

    blobs.forEach((blob, index) => {
        const fileInfo = files[index];
        if (fileInfo.type === 'Illustration') {
            zip.file('illustration.png', blob);
        } else if (fileInfo.type === 'Audio') {
            zip.file('music.ogg', blob);
        } else if (fileInfo.type.startsWith('Chart')) {
            chartsFolder.file(fileInfo.name, blob);
        }
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        ctx.postMessage({ type: 'progress', progress: metadata.percent });
    });

    const safeSongName = selectedSong.name.replace(/\s/g, '_').replace(/[<>:"/\\|?*]/g, '');
    const fileName = `${safeSongName}_all-assets.zip`;

    ctx.postMessage({ type: 'complete', blob: zipBlob, fileName });
};

/** 单个难度打成 .pez / .zip 的内容，返回 blob 与文件名 */
async function buildOneChartZip(
    files: FileInfo[],
    selectedSong: Song,
    selectedDifficulty: string,
    settings: Settings
): Promise<{ blob: Blob; fileName: string; chartId: string }> {
    const chartFile = files.find(f => f.type === `Chart (${selectedDifficulty})`);

    // Select Illustration based on settings
    let illustrationFile: FileInfo | undefined;

    if (settings.exportIllustrationType === 'blur') {
        illustrationFile = files.find(f => f.type === 'Illustration (Blur)');
    }

    // Fallback to Full Size if blur isn't selected or not found
    if (!illustrationFile) {
        illustrationFile = files.find(f => f.type === 'Illustration');
    }

    // Final fallback to any illustration type (e.g. Low-Res)
    if (!illustrationFile) {
        illustrationFile = files.find(f => f.type.startsWith('Illustration'));
    }

    const audioFile = files.find(f => f.type === 'Audio');

    if (!chartFile || !illustrationFile || !audioFile) {
        throw new Error('Could not find all required files (chart, illustration, audio) for export.');
    }

    const chartId = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
    const charter = selectedSong.charters[selectedDifficulty as keyof typeof selectedSong.charters] || 'Pigeon Games';

    // Difficulty Processing
    const diffKey = selectedDifficulty as keyof typeof selectedSong.difficulties;
    let difficultyValStr = selectedSong.difficulties?.[diffKey];

    // Default to 0 if missing or if difficulty is not one of EZ/HD/IN/AT
    if (!difficultyValStr) {
        difficultyValStr = '0';
    }

    const difficultyVal = parseFloat(difficultyValStr);
    const difficultyInt = Math.floor(difficultyVal);
    const levelString = `${selectedDifficulty} Lv.${difficultyInt}`;

    const infoTemplate = `#
Name: {SONG_NAME}
Path: {CHART_ID}
Song: {CHART_ID}.ogg
Picture: {CHART_ID}.png
Chart: {CHART_ID}.json
Level: {LEVEL_STRING}
Composer: {COMPOSER}
Charter: {CHARTER}`;

    const infoContent = infoTemplate
        .replace(/{CHART_ID}/g, chartId)
        .replace('{SONG_NAME}', selectedSong.name)
        .replace('{LEVEL_STRING}', levelString)
        .replace('{COMPOSER}', selectedSong.composer)
        .replace('{CHARTER}', charter);

    const [chartBlob, illustrationBlob, audioBlob] = await Promise.all([
        fetch(chartFile.url).then(res => res.blob()),
        fetch(illustrationFile.url).then(res => res.blob()),
        fetch(audioFile.url).then(res => res.blob()),
    ]);

    const zip = new JSZip();
    zip.file("info.txt", infoContent);
    zip.file(`${chartId}.json`, chartBlob);
    zip.file(`${chartId}.png`, illustrationBlob);
    zip.file(`${chartId}.ogg`, audioBlob);

    if (settings.includeInfoYml) {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}/${month}/${year}`;

         const ymlContent = `name: ${JSON.stringify(selectedSong.name)}
difficulty: ${difficultyVal}
level: ${JSON.stringify(levelString)}
charter: ${JSON.stringify(charter)}
composer: ${JSON.stringify(selectedSong.composer)}
illustrator: "Phigros"
chart: "${chartId}.json"
format: null
music: "${chartId}.ogg"
illustration: "${chartId}.png"
unlockVideo: null
previewStart: 0.0
previewEnd: 20.0
aspectRatio: 1.7777778
backgroundDim: 0.6
lineLength: 6.0
offset: 0.0
tip: null
tags: []
intro: "Phigros Chart Downloader - ${dateStr}" 
holdPartialCover: false
created: null
updated: null
chartUpdated: null`;
        zip.file("info.yml", ymlContent);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const fileExtension = settings.useZipFormat ? 'zip' : 'pez';
    const safeSongName = selectedSong.name.replace(/\s/g, '_').replace(/[<>:"/\\|?*]/g, '');
    const fileName = `${safeSongName}_${selectedDifficulty}.${fileExtension}`;

    return { blob: zipBlob, fileName, chartId };
}

/**
 * 导出谱面。
 * - selectedDifficulty 有值 → 导出那一个难度（原来的行为）
 * - 为 null → 导出这首歌的全部难度，每个难度一个 .pez / .zip，
 *   再统一塞进一个压缩包里，解压后逐个导入即可
 */
const handleExportChart = async (
    files: FileInfo[],
    selectedSong: Song,
    selectedDifficulty: string | null,
    settings: Settings,
    difficulties?: string[]
) => {
    const safeSongName = selectedSong.name.replace(/\s/g, '_').replace(/[<>:"/\\|?*]/g, '');

    // 指定难度：走单文件导出
    if (selectedDifficulty) {
        const { blob, fileName, chartId } = await buildOneChartZip(files, selectedSong, selectedDifficulty, settings);
        ctx.postMessage({ type: 'complete', blob, fileName, chartId });
        return;
    }

    // 未指定：导出全部难度
    const targets = (difficulties && difficulties.length > 0)
        ? difficulties
        : actualDifficulties(selectedSong);

    if (targets.length === 0) {
        throw new Error('该曲目没有任何可用难度。');
    }

    const outer = new JSZip();
    const produced: string[] = [];

    for (let i = 0; i < targets.length; i++) {
        const diff = targets[i];
        ctx.postMessage({
            type: 'progress',
            progress: Math.round((i / targets.length) * 80)
        });
        try {
            const { blob, fileName } = await buildOneChartZip(files, selectedSong, diff, settings);
            outer.file(fileName, blob);
            produced.push(diff);
        } catch (e) {
            // 某个难度缺曲绘/音频时整首会失败；这里跳过它，别让一个难度拖垮全部
            console.warn(`[exportChart] 难度 ${diff} 导出失败：`, e);
        }
    }

    if (produced.length === 0) {
        throw new Error('所有难度都导出失败，请检查该曲目的资源是否完整。');
    }

    const blob = await outer.generateAsync({ type: 'blob' }, (metadata) => {
        // 压缩阶段占总进度的后 20%
        ctx.postMessage({ type: 'progress', progress: 80 + Math.round(metadata.percent * 0.2) });
    });

    ctx.postMessage({
        type: 'complete',
        blob,
        fileName: `${safeSongName}_all-difficulties.zip`,
        chartId: produced.join(','),
    });
};

const handleExportBulkAssets = async (songs: Song[], delaySeconds: number, difficultyScope: string[] | null) => {
    const zip = new JSZip();
    const failedFiles: FailedFile[] = [];

    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const safeSongName = song.name.replace(/\s/g, '_').replace(/[<>:"/\\|?*]/g, '');
        const songFolder = zip.folder(safeSongName);
        if (!songFolder) continue;

        const chartsFolder = songFolder.folder('charts');
        if (!chartsFolder) continue;

        const songId = song.id;

        // Files to try fetching
        const filesToTry = [
            { type: 'Illustration', name: 'illustration.png', url: ghRaw(`7aGiven/Phigros_Resource/refs/heads/illustration/${songId}.png`) },
            { type: 'Illustration (Low-Res)', name: 'illustration_low.png', url: ghRaw(`7aGiven/Phigros_Resource/refs/heads/illustrationLowRes/${songId}.png`) },
            { type: 'Illustration (Blur)', name: 'illustration_blur.png', url: ghRaw(`7aGiven/Phigros_Resource/refs/heads/illustrationBlur/${songId}.png`) },
            { type: 'Audio', name: 'music.ogg', url: ghRaw(`7aGiven/Phigros_Resource/refs/heads/music/${songId}.ogg`) },
        ];

        // 只抓这首歌真实拥有的难度：全库 320 首里 271 首没有 AT，
        // 盲目试 4 个等于每轮多打 271 次必然 404 的请求，既慢又污染失败清单
        const difficulties = resolveDifficulties(song, difficultyScope);
        difficulties.forEach(diff => {
            filesToTry.push({
                type: `Chart (${diff})`,
                name: `${diff}.json`,
                url: ghRaw(`7aGiven/Phigros_Resource/refs/heads/chart/${songId}.0/${diff}.json`)
            });
        });

        for (const file of filesToTry) {
            ctx.postMessage({ 
                type: 'bulkProgress', 
                currentFile: `${song.name} - ${file.type}`, 
                action: 'Downloading', 
                songsLeft: songs.length - i 
            });

            try {
                const res = await fetch(file.url, { referrerPolicy: 'no-referrer' });
                if (res.ok) {
                    const blob = await res.blob();
                    if (file.type.startsWith('Chart')) {
                        chartsFolder.file(file.name, blob);
                    } else {
                        songFolder.file(file.name, blob);
                    }
                } else {
                    failedFiles.push({ songId, songName: song.name, fileType: file.type, url: file.url });
                }
            } catch (e) {
                // 单个文件失败不中断整批，记录下来交给调用方提示 / 重试
                failedFiles.push({ songId, songName: song.name, fileType: file.type, url: file.url });
            }
        }

        // Apply delay between songs (except for the last song)
        if (i < songs.length - 1 && delaySeconds > 0) {
            ctx.postMessage({ 
                type: 'bulkProgress', 
                currentFile: `距离下一首歌曲还有 ${delaySeconds} 秒...`, 
                action: 'Waiting', 
                songsLeft: songs.length - i - 1 
            });
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
    }

    ctx.postMessage({ 
        type: 'bulkProgress', 
        currentFile: '所有文件已下载', 
        action: 'Zipping', 
        songsLeft: 0 
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        ctx.postMessage({ 
            type: 'bulkProgress', 
            currentFile: '正在压缩...', 
            action: 'Zipping', 
            songsLeft: 0,
            percent: metadata.percent
        });
    });

    ctx.postMessage({ type: 'complete', blob: zipBlob, fileName: 'Phigros_All_Assets.zip', failedFiles });
};
