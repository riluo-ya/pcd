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
 *
 * 通道复用一条：每帧 new MessageChannel() 会在几百帧的量级上制造可观的
 * 端口对象与 GC 压力，而这些对象做的事完全一样。
 */
let yieldChannel = null;
function yieldToUi() {
  if (!yieldChannel) {
    yieldChannel = new MessageChannel();
    if (yieldChannel.port1.start) yieldChannel.port1.start();
  }
  return new Promise(resolve => {
    yieldChannel.port1.onmessage = () => resolve();
    yieldChannel.port2.postMessage(0);
  });
}

/** 编码队列水位上限。超过就等 dequeue，避免输入帧在编码器里无限堆积 */
const QUEUE_HIGH = 8;
/** dequeue 事件兜底超时：个别实现不派发该事件时也不能把导出卡死 */
const QUEUE_WAIT_TIMEOUT = 250;

/**
 * 编码器背压。
 * 实测：连续 push 不检查队列时，encodeQueueSize 会一直等于已推送帧数（编码器
 * 根本来不及排空），200 帧左右标签页直接崩溃。这里等队列降到水位以下再继续，
 * 让内存占用稳定在个位数帧，而不是随帧数线性增长。
 */
export function waitForQueue(encoder, limit = QUEUE_HIGH) {
  if (encoder.encodeQueueSize < limit) return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      encoder.removeEventListener('dequeue', onDequeue);
      clearTimeout(timer);
      resolve();
    };
    const onDequeue = () => { if (encoder.encodeQueueSize < limit) done(); };
    const timer = setTimeout(done, QUEUE_WAIT_TIMEOUT);
    encoder.addEventListener('dequeue', onDequeue);
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
  // 与视频轨同理：error 回调里 throw 只会变成未捕获异常，外层 try/catch 接不到，
  // 界面会一直停在「正在收尾音频…」。这里先记下来，由主流程转成正常报错。
  let audioError = null;
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
    error: error => {
      audioError = error instanceof Error ? error : new Error(String((error && error.message) || error));
    }
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
    if (audioError) { try { encoder.close(); } catch { /* 已关闭 */ } throw audioError; }
  }
  onStage?.('正在收尾音频…');
  await encoder.flush();
  encoder.close();
  if (audioError) throw audioError;
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

  // 16:9 时渲染尺寸就是输出尺寸，直接拿渲染画布编码，省掉一次 1920×1080 全画布拷贝；
  // 只有 4:3 需要中间画布做裁切。
  const useDirect = aspect === '16:9' && width === WIDTH && height === HEIGHT;
  let output = null, ctx = null;
  if (!useDirect) {
    output = document.createElement('canvas'); output.width = width; output.height = height;
    ctx = output.getContext('2d', { alpha: false });
  }

  // 曲面效果走 WebGL：每帧把画布上传 GPU 再读回，既慢又依赖显卡上下文。
  // 浏览器不支持（硬件加速被关、显卡被拉黑、上下文丢失）时改为平面并提示，
  // 而不是渲染几百帧之后才中断 —— 那样前面几分钟的等待全白费。
  const warnings = [];
  let curvatureOn = renderer.design.screenCurve === 'curved';
  if (curvatureOn) {
    renderer.render(start, options, view, selectedId);
    if (!renderer.curvatureSupported) {
      renderer.setDesign({ screenCurve: 'flat' });
      curvatureOn = false;
      warnings.push('当前浏览器无法渲染曲面效果，已改为平面画面导出。');
    }
  }

  const videoSamples = [];
  let description = null;
  // 编码器的 error 回调里直接 throw 只会变成未捕获异常，外层 try/catch 接不到，
  // 界面会一直停在「正在收尾视频…」。这里先记下来，由主流程转成正常报错。
  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      const bytes = new Uint8Array(chunk.byteLength);
      chunk.copyTo(bytes);
      videoSamples.push({ data: bytes, isKey: chunk.type === 'key' });
      if (!description && meta && meta.decoderConfig && meta.decoderConfig.description) {
        description = new Uint8Array(meta.decoderConfig.description);
      }
    },
    error: error => {
      encoderError = error instanceof Error ? error : new Error(String((error && error.message) || error));
    }
  });
  encoder.configure({ codec, width, height, bitrate, framerate: fps, avc: { format: 'avc' } });

  const release = () => {
    try { encoder.close(); } catch { /* 已关闭 */ }
    renderer.canvas.width = 1; renderer.canvas.height = 1;
    if (output) { output.width = 1; output.height = 1; }
  };

  const startedAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const elapsedMs = () => ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - startedAt;

  try {
    for (let index = 0; index < frameCount; index++) {
      if (isCancelled()) { release(); return null; }
      const time = Math.min(end, start + index / fps);
      renderer.render(time, options, view, selectedId);
      if (curvatureOn && !renderer.curvatureSupported) {
        // 导出途中上下文丢失：切平面继续，不要整段作废
        renderer.setDesign({ screenCurve: 'flat' });
        curvatureOn = false;
        warnings.push('导出过程中曲面渲染中断（多为显卡上下文丢失），后续帧按平面画面渲染。');
      }
      if (ctx) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
        if (aspect === '4:3') ctx.drawImage(canvas, 240, 0, 1440, 1080, 0, 0, 1440, 1080);
        else ctx.drawImage(canvas, 0, 0, width, height);
      }

      const frame = new VideoFrame(useDirect ? canvas : output, { timestamp: Math.round(index * 1e6 / fps) });
      // 每秒一个关键帧：拖动进度条时能快速定位，也不至于让文件膨胀太多
      encoder.encode(frame, { keyFrame: index % fps === 0 });
      frame.close();
      if (encoderError) throw encoderError;
      onProgress(index + 1, frameCount, time);
      // 每隔一段把剩余时间报给界面，避免几百帧的导出看起来像卡死
      if (index > 0 && index % 30 === 0) {
        const remain = Math.max(0, Math.round((frameCount - index - 1) * (elapsedMs() / (index + 1)) / 1000));
        onStage(`正在渲染画面 ${index + 1}/${frameCount}（约还需 ${remain} 秒）`);
      }
      await waitForQueue(encoder);
      await yieldToUi();
    }
    onStage('正在收尾视频…');
    await encoder.flush();
    if (encoderError) throw encoderError;
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
    const warning = warnings.join(' ') || null;
    return returnRaw
      ? { blob, frameCount, width, height, fps, durationSeconds, hasAudio: !!audio, warning,
          rawVideo: { codecDescription: description, width, height, frameRate: fps, samples: videoSamples } }
      : { blob, frameCount, width, height, fps, durationSeconds, hasAudio: !!audio, warning };
  } catch (error) {
    release();
    throw error;
  }
}
