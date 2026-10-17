import JSZip from 'jszip';
import { FileInfo, Song } from '../types';
import { Settings } from '../defaultSettings';
import { ProxySource, getResourceUrl, hasPerDifficultyIllustrations, getDifficultyIllustrationUrl } from '../utils/resourceUrls';
import { OfficialChart, officialToRpe } from '../utils/chartConverter';
import { getExtraChart, getExtraCharts } from '../extraCharts';
import { resourceFetch, setGithubToken } from '../utils/githubAuth';

/** 批量导出的打包方式 */
export type BulkPackaging = 'per-difficulty' | 'raw';

// Define message types for type safety
export type ExportMessage =
    | { type: 'exportAllAssets'; files: FileInfo[]; selectedSong: Song; githubToken?: string }
    | { type: 'exportChart'; files: FileInfo[]; selectedSong: Song; selectedDifficulty: string | null; difficulties?: string[]; settings: Settings; githubToken?: string }
    | {
        type: 'exportBulkAssets';
        songs: Song[];
        delaySeconds: number;
        proxySource: ProxySource;
        fileName?: string;
        difficultyScope?: string[] | null;
        packaging?: BulkPackaging;
        settings?: Settings;
        githubToken?: string;
    };

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

const ALL_DIFFS = ['EZ', 'HD', 'IN', 'AT'];

ctx.onmessage = async (event: MessageEvent<ExportMessage>) => {
    const { type } = event.data;
    setGithubToken(event.data.githubToken ?? '');

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
            await handleExportBulkAssets(
                event.data.songs,
                event.data.delaySeconds,
                event.data.proxySource,
                event.data.fileName,
                event.data.difficultyScope ?? null,
                event.data.packaging ?? 'per-difficulty',
                event.data.settings
            );
        }
    } catch (error) {
        ctx.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
    }
};

// ---------------------------------------------------------------------------
// 难度解析：批量导出只抓歌曲真实拥有的难度，避免大量必然 404 的请求
// ---------------------------------------------------------------------------

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
 * 该曲目实际拥有的难度列表（含 extraCharts 声明的额外难度）。
 * 难度表整份缺失时退回全 4 个 —— 拿不到数据就靠 404 兜底，
 * 总比一首歌一个谱面都不下要好。
 */
function actualDifficulties(song: Song): string[] {
    const has = ALL_DIFFS.filter(d => hasDifficulty(song, d));
    const extras = getExtraCharts(song.id).map(e => e.difficulty);
    const merged = [...has, ...extras.filter(d => !has.includes(d))];
    return merged.length > 0 ? merged : [...ALL_DIFFS];
}

/** 按用户指定的范围收窄：没指定或指定了空数组就用曲目实际拥有的 */
function resolveDifficulties(song: Song, scope: string[] | null): string[] {
    const actual = actualDifficulties(song);
    if (!scope || scope.length === 0) return actual;
    const picked = ALL_DIFFS.filter(d => scope.includes(d) && actual.includes(d));
    // 用户勾的难度这首歌一个都没有时，退回实际拥有的，避免导出空包
    return picked.length > 0 ? picked : actual;
}

// ---------------------------------------------------------------------------
// 单曲：全部资源
// ---------------------------------------------------------------------------

const handleExportAllAssets = async (files: FileInfo[], selectedSong: Song) => {
    const zip = new JSZip();
    const chartsFolder = zip.folder('charts');
    if (!chartsFolder) throw new Error("无法在压缩包内创建 charts 目录。");

    const filePromises = files.map(file =>
        resourceFetch(file.url, { referrerPolicy: 'no-referrer' }).then(res => {
            if (!res.ok) throw new Error(`下载失败 ${file.url}：${res.statusText}`);
            return res.blob();
        })
    );

    const blobs = await Promise.all(filePromises);

    blobs.forEach((blob, index) => {
        const fileInfo = files[index];
        if (fileInfo.type === 'Illustration') {
            zip.file('illustration.png', blob);
        } else if (/^Illustration \((EZ|HD|IN|AT)\)$/.test(fileInfo.type)) {
            zip.file(`illustration_${fileInfo.type.slice(14, 16)}.png`, blob);
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

// ---------------------------------------------------------------------------
// 单曲：谱面包
// ---------------------------------------------------------------------------

/** 从已探测到的文件里挑出该难度要用的曲绘（与 exportEstimate 的优先级一致） */
function pickIllustrationFile(files: FileInfo[], difficulty: string, illustrationType: 'full' | 'blur'): FileInfo | undefined {
    if (illustrationType === 'blur') {
        const blur = files.find(f => f.type === 'Illustration (Blur)');
        if (blur) return blur;
    }
    return files.find(f => f.type === `Illustration (${difficulty})`)
        ?? files.find(f => f.type === 'Illustration')
        ?? files.find(f => f.type.startsWith('Illustration'));
}

/** 单个难度打成 .pez / .zip 的内容，返回 blob 与文件名 */
async function buildOneChartZip(
    files: FileInfo[],
    selectedSong: Song,
    selectedDifficulty: string,
    settings: Settings
): Promise<{ blob: Blob; fileName: string; chartId: string }> {
    const chartFile = files.find(f => f.type === `Chart (${selectedDifficulty})`);
    const illustrationFile = pickIllustrationFile(files, selectedDifficulty, settings.exportIllustrationType);
    const audioFile = files.find(f => f.type === 'Audio');

    if (!chartFile || !illustrationFile || !audioFile) {
        throw new Error('缺少导出所需的谱面 / 曲绘 / 音频文件。');
    }

    const [chartBlob, illustrationBlob, audioBlob] = await Promise.all([
        resourceFetch(chartFile.url).then(res => res.blob()),
        resourceFetch(illustrationFile.url).then(res => res.blob()),
        resourceFetch(audioFile.url).then(res => res.blob()),
    ]);

    return composeChartZip(selectedSong, selectedDifficulty, chartBlob, illustrationBlob, audioBlob, settings);
}

/**
 * 用现成的 blob 组装一个谱面包（.pez / .zip）。
 * 单曲导出与批量导出共用：批量场景下资源每首歌只下载一次，
 * 再复用给每个难度，避免同一个音频被重复请求 4 遍。
 */
async function composeChartZip(
    selectedSong: Song,
    selectedDifficulty: string,
    chartBlob: Blob,
    illustrationBlob: Blob,
    audioBlob: Blob,
    settings: Settings
): Promise<{ blob: Blob; fileName: string; chartId: string }> {
    const chartId = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
    const charter = selectedSong.charters[selectedDifficulty as keyof typeof selectedSong.charters] || 'Pigeon Games';

    // Difficulty Processing
    const diffKey = selectedDifficulty as keyof typeof selectedSong.difficulties;
    let difficultyValStr = selectedSong.difficulties?.[diffKey]
        ?? getExtraChart(selectedSong.id, selectedDifficulty)?.level;

    // Default to 0 if missing or if difficulty is not one of EZ/HD/IN/AT
    if (!difficultyValStr) {
        difficultyValStr = '0';
    }

    // Non-numeric levels (e.g. SP "?") export with difficulty 0 but keep the original label
    const parsedDifficulty = parseFloat(difficultyValStr);
    const difficultyVal = Number.isFinite(parsedDifficulty) ? parsedDifficulty : 0;
    const levelLabel = Number.isFinite(parsedDifficulty) ? String(Math.floor(parsedDifficulty)) : difficultyValStr;
    const levelString = `${selectedDifficulty} Lv.${levelLabel}`;

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

    const convertToRpe = settings.chartFormatConversion === 'rpe';
    let chartData: Blob | string = chartBlob;
    if (convertToRpe) {
        const official: OfficialChart = JSON.parse(await chartBlob.text());
        chartData = JSON.stringify(officialToRpe(official, {
            name: selectedSong.name,
            level: levelString,
            charter,
            composer: selectedSong.composer,
            song: `${chartId}.ogg`,
            background: `${chartId}.png`,
            id: chartId,
        }, { easingFitting: settings.chartEasingFitting }));
    }

    const zip = new JSZip();
    zip.file("info.txt", infoContent);
    zip.file(`${chartId}.json`, chartData);
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
format: ${convertToRpe ? '"rpe"' : 'null'}
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
 * - selectedDifficulty 有值 → 导出那一个难度
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

// ---------------------------------------------------------------------------
// 批量导出
// ---------------------------------------------------------------------------

/**
 * 批量导出。
 *
 * 包结构（默认 per-difficulty）：
 *   曲名/
 *   ├── 曲名_EZ.pez
 *   ├── 曲名_HD.pez
 *   └── 曲名_IN.pez
 *
 * 即每个难度一个可直接导入 Phira 的谱面包，而不是散装的资源文件。
 * 代价是同一份曲绘/音频会在每个难度的包里各存一份，体积会变大；
 * 想省体积可以切到 'raw' 模式（资源只存一份 + charts/*.json）。
 *
 * 资源每首歌只下载一次，再复用给所有难度，请求数不会因为打包方式而增加。
 */
const handleExportBulkAssets = async (
    songs: Song[],
    delaySeconds: number,
    proxySource: ProxySource,
    outFileName?: string,
    difficultyScope: string[] | null = null,
    packaging: BulkPackaging = 'per-difficulty',
    settings?: Settings
) => {
    const zip = new JSZip();
    const failedFiles: FailedFile[] = [];

    // 批量场景沿用调用方传来的导出偏好；没传就用一份保守默认值
    const packSettings: Settings = settings ?? {
        useZipFormat: false,
        includeInfoYml: true,
        analyticsEnabled: false,
        exportIllustrationType: 'full',
        chartFormatConversion: 'none',
        chartEasingFitting: true,
        useNewUi: false,
        proxySource,
        githubToken: '',
        newUiAudioPreview: false,
        newUiAudioVolume: 1,
        newUiLoopAudio: false,
        newUiAutoplayAudio: false,
        newUiBlur: false,
        newUiShowVisualizer: false,
        newUiVisualizerColor: 'gray',
        newUiVisualizerHeight: 60,
        newUiVisualizerOpacity: 60,
        newUiSongSpecificEffects: false,
        bulkDownloadMode: true,
        advancedInfo: false,
        shareCardEnabled: false,
        shareCardBpm: false,
        shareCardJudgeLines: false,
        shareCardDuration: false,
        shareCardNoteCounts: false,
    };

    const report = (msg: string, action: 'Downloading' | 'Waiting' | 'Zipping', left: number) => {
        ctx.postMessage({ type: 'bulkProgress', currentFile: msg, action, songsLeft: left });
    };

    /** 下载一个文件，失败记进 failedFiles 并返回 null */
    const tryFetch = async (url: string, song: Song, label: string): Promise<Blob | null> => {
        try {
            const res = await resourceFetch(url, { referrerPolicy: 'no-referrer' });
            if (res.ok) return await res.blob();
            failedFiles.push({ songId: song.id, songName: song.name, fileType: label, url });
        } catch (e) {
            failedFiles.push({ songId: song.id, songName: song.name, fileType: label, url });
        }
        return null;
    };

    for (let i = 0; i < songs.length; i++) {
        const song = songs[i];
        const safeName = song.name.replace(/\s/g, '_').replace(/[<>:"/\\|?*]/g, '');
        const folder = zip.folder(safeName);
        if (!folder) continue;
        const songId = song.id;
        const left = songs.length - i;

        // 只抓这首歌真实拥有的难度：全库几百首里大多数没有 AT，
        // 盲目试 4 个等于每轮多打几百次必然 404 的请求，既慢又污染失败清单
        const difficulties = resolveDifficulties(song, difficultyScope);

        // ---- 共享资源：每首歌只下一次 ----
        report(`${song.name} - 曲绘`, 'Downloading', left);
        const illustration = await tryFetch(
            getResourceUrl(proxySource, 'illustration', `${songId}.png`), song, 'Illustration'
        );

        report(`${song.name} - 音频`, 'Downloading', left);
        const audio = await tryFetch(
            getResourceUrl(proxySource, 'music', `${songId}.ogg`), song, 'Audio'
        );

        if (packaging === 'raw') {
            // 旧格式：资源平铺 + charts/ 目录放谱面 JSON，体积最小
            if (illustration) folder.file('illustration.png', illustration);
            if (audio) folder.file('music.ogg', audio);

            report(`${song.name} - 曲绘（低清）`, 'Downloading', left);
            const low = await tryFetch(
                getResourceUrl(proxySource, 'illustrationLowRes', `${songId}.png`),
                song, 'Illustration (Low-Res)'
            );
            if (low) folder.file('illustration_low.png', low);

            report(`${song.name} - 曲绘（模糊）`, 'Downloading', left);
            const blur = await tryFetch(
                getResourceUrl(proxySource, 'illustrationBlur', `${songId}.png`),
                song, 'Illustration (Blur)'
            );
            if (blur) folder.file('illustration_blur.png', blur);

            const chartsFolder = folder.folder('charts');
            for (const diff of difficulties) {
                report(`${song.name} - Chart (${diff})`, 'Downloading', left);
                const blob = await tryFetch(
                    getResourceUrl(proxySource, 'chart', `${songId}.0/${diff}.json`),
                    song, `Chart (${diff})`
                );
                if (blob && chartsFolder) chartsFolder.file(`${diff}.json`, blob);
            }

            // 分难度曲绘的曲目额外补一份
            if (hasPerDifficultyIllustrations(songId)) {
                for (const diff of ALL_DIFFS) {
                    report(`${song.name} - 曲绘 (${diff})`, 'Downloading', left);
                    const img = await tryFetch(
                        getDifficultyIllustrationUrl(proxySource, songId, diff),
                        song, `Illustration (${diff})`
                    );
                    if (img) folder.file(`illustration_${diff}.png`, img);
                }
            }
        } else if (illustration && audio) {
            // 默认格式：每个难度一个独立的谱面包
            for (const diff of difficulties) {
                report(`${song.name} - Chart (${diff})`, 'Downloading', left);
                const chart = await tryFetch(
                    getResourceUrl(proxySource, 'chart', `${songId}.0/${diff}.json`),
                    song, `Chart (${diff})`
                );
                if (!chart) continue;
                try {
                    const { blob, fileName } = await composeChartZip(song, diff, chart, illustration, audio, packSettings);
                    folder.file(fileName, blob);
                } catch (e) {
                    // 组装失败也别整批中断，退回裸 JSON 至少还有谱面
                    console.warn(`[bulk] ${song.name} ${diff} 打包失败，退回裸 JSON：`, e);
                    folder.file(`${safeName}_${diff}.json`, chart);
                }
            }
        } else {
            // 资源不全：把能拿到的谱面单独放出来，不至于整首消失
            const chartsFolder = folder.folder('charts');
            for (const diff of difficulties) {
                report(`${song.name} - Chart (${diff})`, 'Downloading', left);
                const blob = await tryFetch(
                    getResourceUrl(proxySource, 'chart', `${songId}.0/${diff}.json`),
                    song, `Chart (${diff})`
                );
                if (blob && chartsFolder) chartsFolder.file(`${diff}.json`, blob);
            }
        }

        // Apply delay between songs (except for the last song)
        if (i < songs.length - 1 && delaySeconds > 0) {
            report(`距离下一首歌曲还有 ${delaySeconds} 秒…`, 'Waiting', songs.length - i - 1);
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
    }

    report('所有文件已下载', 'Zipping', 0);

    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        ctx.postMessage({
            type: 'bulkProgress',
            currentFile: '正在压缩…',
            action: 'Zipping',
            songsLeft: 0,
            percent: metadata.percent
        });
    });

    ctx.postMessage({
        type: 'complete',
        blob: zipBlob,
        fileName: outFileName || 'Phigros_All_Assets.zip',
        failedFiles
    });
};
