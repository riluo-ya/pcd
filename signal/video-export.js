/* 本地导出 MP4：用 WebCodecs 把画面编成 H.264、音轨编成 AAC，再用 mp4-muxer 封装。
   全程在浏览器里跑，不上传任何数据；不支持 WebCodecs 的浏览器会明确报错。 */

import { APP_CONFIG } from './config.js';
import { SignalRenderer, WIDTH, HEIGHT } from './engine.js';
import { previewIssue } from './editor-data.js';
import { buildMp4, AAC_FRAME_SAMPLES } from './mp4-muxer.js';

const MAX_FRAMES = 5000;

/**
 * 让出主线程但不受后台节流影响。
 * requestAnimationFrame 在标签页不可见时会被节流甚至完全暂停 —— 导出动辄几百帧，
 * 用户一切走就卡住。setTimeout 在后台同样被限制到 ≥1s。
 * MessageChannel 走的是宏任务队列，没有这两层限制。
 */
function yieldToUi() {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { channel.port1.close(); resolve(); };
    channel.port2.postMessage(0);
  });
}
/** 从宽泛到严格依次尝试，硬件编码器不一定支持 High profile */
const VIDEO_CODECS = ['avc1.4d0028', 'avc1.640028', 'avc1.420028'];
const AUDIO_CODEC = 'mp4a.40.2';
const AUDIO_BITRATE = 192000;

function resolutionOf(aspect) {
  return aspect === '4:3' ? { width: 1440, height: 1080 } : { width: 1920, height: 1080 };
}

async function pickVideoCodec({ width, height, bitrate, frameRate }) {
  if (typeof VideoEncoder === 'undefined') throw new Error('当前浏览器不支持 WebCodecs，无法本地导出 MP4，请改用 PNG 帧序列。');
  for (const codec of VIDEO_CODECS) {
    const support = await VideoEncoder.isConfigSupported({ codec, width, height, bitrate, framerate: frameRate });
    if (support.supported) return codec;
  }
  throw new Error('当前浏览器没有可用的 H.264 编码器，请改用 PNG 帧序列。');
}

/**
 * 当前浏览器能否编码 AAC。
 * 并非所有 Chromium 构建都带 AAC 编码器（有些只给 Opus），
 * 所以要在运行时探测：不能编码就明确告诉用户，而不是悄悄导出无声视频。
 */
let aacSupport = null;
export async function canEncodeAudio() {
  if (aacSupport !== null) return aacSupport;
  if (typeof AudioEncoder === 'undefined') { aacSupport = false; return false; }
  try {
    const support = await AudioEncoder.isConfigSupported({
      codec: AUDIO_CODEC, sampleRate: 44100, numberOfChannels: 2, bitrate: AUDIO_BITRATE
    });
    aacSupport = !!support.supported;
  } catch {
    aacSupport = false;
  }
  return aacSupport;
}

let audioBufferCache = null;
/** 解码音轨。整段只解一次并缓存，反复导出不会重复请求 */
async function loadSoundtrack() {
  if (audioBufferCache) return audioBufferCache;
  const response = await fetch('assets/audio.wav', { cache: 'force-cache' });
  if (!response.ok) throw new Error('音轨加载失败（assets/audio.wav）。');
  const context = new (window.AudioContext || window.webkitAudioContext)();
  try {
    audioBufferCache = await context.decodeAudioData(await response.arrayBuffer());
  } finally {
    context.close();
  }
  return audioBufferCache;
}

/** 按导出区间裁剪出交错的 Float32 数据，AAC 编码器只吃这一种布局 */
function sliceInterleaved(buffer, startSeconds, endSeconds) {
  const rate = buffer.sampleRate;
  const channels = Math.min(buffer.numberOfChannels, 2);
  const from = Math.max(0, Math.floor(startSeconds * rate));
  const to = Math.min(buffer.length, Math.ceil(endSeconds * rate));
  const frames = Math.max(0, to - from);
  const data = new Float32Array(frames * channels);
  for (let c = 0; c < channels; c++) {
    const source = buffer.getChannelData(c);
    for (let i = 0; i < frames; i++) data[i * channels + c] = source[from + i];
  }
  return { data, frames, channels, rate };
}

async function encodeAudio({ start, end, onStage }) {
  const buffer = await loadSoundtrack();
  const { data, frames, channels, rate } = sliceInterleaved(buffer, start, end);
  if (frames === 0) return null;

  if (!await canEncodeAudio()) {
    throw new Error('当前浏览器不支持 AAC 音频编码，无法写入 MP4 音轨；请取消勾选「包含音频」后再导出，或用 PNG 帧序列在剪辑软件里合成。');
  }
  // 采样率/声道数要与探测时一致才保险，这里再确认一次实际配置
  const support = await AudioEncoder.isConfigSupported({
    codec: AUDIO_CODEC, sampleRate: rate, numberOfChannels: channels, bitrate: AUDIO_BITRATE
  });
  if (!support.supported) throw new Error(`音轨参数（${rate} Hz / ${channels} 声道）不被当前浏览器支持。`);

  const samples = [];
  let description = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      // 每帧固定 1024 采样。不要读 chunk.duration —— 它的单位是微秒，
      // 当成采样数会让每帧被算成约 0.53 秒，整条音轨变成几百秒，
      // 播放器拿音轨当主时钟时画面就会被压缩快进。
      samples.push({ data: bytes, duration: AAC_FRAME_SAMPLES });
      if (!description && meta && meta.decoderConfig && meta.decoderConfig.description) {
        description = new Uint8Array(meta.decoderConfig.description);
      }
    },
    error: error => { throw error; }
  });
  encoder.configure({ codec: AUDIO_CODEC, sampleRate: rate, numberOfChannels: channels, bitrate: AUDIO_BITRATE });

  const block = AAC_FRAME_SAMPLES;
  for (let offset = 0; offset < frames; offset += block) {
    const count = Math.min(block, frames - offset);
    const chunk = new Float32Array(count * channels);
    chunk.set(data.subarray(offset * channels, (offset + count) * channels));
    const frame = new AudioData({
      format: 'f32', sampleRate: rate, numberOfFrames: count, numberOfChannels: channels,
      timestamp: Math.round(offset * 1e6 / rate), data: chunk
    });
    encoder.encode(frame);
    frame.close();
  }
  onStage?.('正在收尾音频…');
  await encoder.flush();
  encoder.close();
  if (!samples.length) return null;
  return { codecDescription: description, sampleRate: rate, channels, samples, bitrate: AUDIO_BITRATE };
}

/**
 * 导出 MP4（本地渲染 + 本地编码）。
 * 与 exportFrameZip 的入参保持一致，方便 studio.js 按格式分发。
 */
export async function exportVideo({
  options, design, view, selectedId, aspect, start, end, fps,
  withAudio = true, bitrateMbps = 8, onProgress = () => {}, onStage = () => {}, isCancelled = () => false,
  returnRaw = false
}) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end > APP_CONFIG.duration) {
    throw new Error(`时间范围需在 0–${APP_CONFIG.duration.toFixed(2)} 秒内，并且起点不晚于终点。`);
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 120) throw new Error('帧率需为 1–120 的整数。');
  if (!['16:9', '4:3'].includes(aspect)) throw new Error('画面比例无效。');
  const issue = previewIssue(design); if (issue) throw new Error(issue);

  const frameCount = Math.floor((end - start) * fps + 1e-9) + 1;
  if (frameCount > MAX_FRAMES) throw new Error(`单次导出最多 ${MAX_FRAMES} 帧，请缩短时间范围或降低帧率。`);

  const { width, height } = resolutionOf(aspect);
  const bitrate = Math.round(bitrateMbps * 1e6);
  const codec = await pickVideoCodec({ width, height, bitrate, frameRate: fps });

  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const renderer = new SignalRenderer(canvas); renderer.setDesign(design);
  const output = document.createElement('canvas'); output.width = width; output.height = height;
  const ctx = output.getContext('2d', { alpha: false });

  const videoSamples = [];
  let description = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      videoSamples.push({ data: bytes, isKey: chunk.type === 'key' });
      if (!description && meta && meta.decoderConfig && meta.decoderConfig.description) {
        description = new Uint8Array(meta.decoderConfig.description);
      }
    },
    error: error => { throw error; }
  });
  encoder.configure({ codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' } });

  const release = () => {
    try { encoder.close(); } catch { /* 已关闭 */ }
    renderer.canvas.width = 1; renderer.canvas.height = 1;
    output.width = 1; output.height = 1;
  };

  try {
    for (let index = 0; index < frameCount; index++) {
      if (isCancelled()) { release(); return null; }
      const time = Math.min(end, start + index / fps);
      renderer.render(time, options, view, selectedId);
      if (design.screenCurve === 'curved' && !renderer.curvatureSupported) {
        throw new Error('当前浏览器未能渲染曲面效果，已停止导出。');
      }
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
      if (aspect === '4:3') ctx.drawImage(canvas, 240, 0, 1440, 1080, 0, 0, 1440, 1080);
      else ctx.drawImage(canvas, 0, 0, width, height);

      const frame = new VideoFrame(output, { timestamp: Math.round(index * 1e6 / fps) });
      // 每秒一个关键帧：拖动进度条时能快速定位，也不至于让文件膨胀太多
      encoder.encode(frame, { keyFrame: index % fps === 0 });
      frame.close();
      onProgress(index + 1, frameCount, time);
      await yieldToUi();
    }
    onStage('正在收尾视频…');
    await encoder.flush();
    release();
    if (!videoSamples.length) throw new Error('没有编码出任何画面帧。');

    let audio = null;
    if (withAudio) {
      onStage('正在编码音频…');
      // 画面实际编码了多少帧就配多长的声音；画面因故少了几帧时，
      // 音频多出来的尾部会让「画面播完声音还在响」，所以按画面长度封顶。
      const videoSeconds = videoSamples.length / fps;
      audio = await encodeAudio({ start, end: Math.min(end, start + videoSeconds), onStage });
      if (!audio) onStage('音轨在所选区间内没有内容，已导出无声视频。');
    }

    onStage('正在封装 MP4…');
    const blob = buildMp4({
      video: { codecDescription: description, width, height, frameRate: fps, samples: videoSamples, bitrate },
      audio
    });
    // 导出往往只要几秒就完成（编码走 GPU，很快），用户容易怀疑
    // 「是不是没渲染完」。所以把实际时长一并回传，让界面直接显示出来核对。
    const durationSeconds = videoSamples.length / fps;
    // returnRaw 只给测试用：帧数据和 blob 各占一份内存，默认不回传，
    // 否则几百 MB 的导出会让内存占用翻倍。
    return returnRaw
      ? { blob, frameCount, width, height, fps, durationSeconds, hasAudio: !!audio,
          rawVideo: { codecDescription: description, width, height, frameRate: fps, samples: videoSamples } }
      : { blob, frameCount, width, height, fps, durationSeconds, hasAudio: !!audio };
  } catch (error) {
    release();
    throw error;
  }
}
