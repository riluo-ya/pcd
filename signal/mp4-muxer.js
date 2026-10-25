/* MP4（ISO BMFF）封装：把 WebCodecs 产出的 H.264 / AAC 裸流打包成 .mp4。
   不依赖任何第三方库，纯本地封装，不上传任何数据。

   结构：ftyp + moov + mdat（moov 放前面，播放器可以边下边播）
   moov 里每个 track 一套 stbl（stsd / stts / stsc / stsz / co64），
   视频额外写 stss 标记关键帧，否则播放器拖动进度条会花屏。 */

/** AAC 一帧固定 1024 采样 */
export const AAC_FRAME_SAMPLES = 1024;

/**
 * 时间基准（timescale）的选择很关键，别改回 fps。
 * 早期版本让视频轨 timescale = fps（30fps 时就是 1/30 秒一个单位），
 * 虽然数学上等价且 ffmpeg 认，但大量播放器/硬解会误读这么低的基准，
 * 表现就是「画面和声音一起变快」。
 *
 * 这里改用业界通用做法：
 *   - 视频轨：fps * 1000，每帧 delta 恒为 1000（即 1 毫秒）
 *   - movie：1000（毫秒）
 *   - 音频轨：采样率（44100 等），delta 为采样数
 * 这样 fps 取 1–120 任意整数时 delta 都是整数，不会出现非整数时长。
 */
const MOVIE_TIMESCALE = 1000;
const videoTimescale = fps => fps * 1000;
const VIDEO_SAMPLE_DELTA = 1000;

const str4 = s => [s.charCodeAt(0), s.charCodeAt(1), s.charCodeAt(2), s.charCodeAt(3)];
const fourCC = s => new Uint8Array(str4(s));

function concat(...parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

const u8 = v => new Uint8Array([v & 255]);
function u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v & 0xffff); return b; }
function u24(v) { const b = new Uint8Array(3); const d = new DataView(b.buffer); d.setUint16(0, (v >> 8) & 0xffff); d.setUint8(2, v & 255); return b; }
function u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0); return b; }
function u64(v) {
  const b = new Uint8Array(8), d = new DataView(b.buffer);
  d.setUint32(0, Math.floor(v / 4294967296)); d.setUint32(4, v % 4294967296); return b;
}
/** 16.16 定点数，tkhd 尺寸与 mp4a 采样率用这个格式 */
const fp16 = v => u32(Math.round(v * 65536));

function box(type, ...parts) {
  let size = 8;
  for (const p of parts) size += p.length;
  const head = new Uint8Array(8), dv = new DataView(head.buffer);
  dv.setUint32(0, size);
  head.set(str4(type), 4);
  return concat(head, ...parts);
}

/** 描述符长度：每字节存 7 位，高位表示后面还有字节 */
function descSize(size) {
  const bytes = [size & 0x7f];
  size >>= 7;
  while (size > 0) { bytes.unshift((size & 0x7f) | 0x80); size >>= 7; }
  return new Uint8Array(bytes);
}
function descriptor(tag, ...payload) {
  const body = concat(...payload);
  return concat(u8(tag), descSize(body.length), body);
}

const IDENTITY_MATRIX = concat(
  u32(0x00010000), u32(0), u32(0),
  u32(0), u32(0x00010000), u32(0),
  u32(0), u32(0), u32(0x40000000)
);

function ftyp() {
  return box('ftyp', fourCC('isom'), u32(0x200), fourCC('isom'), fourCC('iso2'), fourCC('avc1'), fourCC('mp41'));
}

function mvhd(timescale, duration, nextTrackId) {
  return box('mvhd',
    u32(0),            // version + flags
    u32(0), u32(0),    // creation / modification time
    u32(timescale), u32(duration),
    u32(0x00010000),   // rate 1.0
    u16(0x0100),       // volume 1.0
    u16(0),            // reserved
    new Uint8Array(8), // reserved
    IDENTITY_MATRIX,
    new Uint8Array(24), // pre_defined
    u32(nextTrackId)
  );
}

function tkhd(trackId, duration, width, height, isAudio) {
  return box('tkhd',
    u32(0x000007),     // version 0 + flags: enabled | inMovie | inPreview
    u32(0), u32(0),    // creation / modification
    u32(trackId),
    u32(0),            // reserved
    u32(duration),
    new Uint8Array(8), // reserved
    u16(0),            // layer
    u16(0),            // alternate group
    isAudio ? u16(0x0100) : u16(0), // volume（视频轨为 0）
    u16(0),            // reserved
    IDENTITY_MATRIX,
    fp16(isAudio ? 0 : width),
    fp16(isAudio ? 0 : height)
  );
}

function mdhd(timescale, duration) {
  return box('mdhd',
    u32(0), u32(0), u32(0),
    u32(timescale), u32(duration),
    u16(0x55c4),       // language 'und'
    u16(0)             // pre_defined
  );
}

function hdlr(handlerType) {
  return box('hdlr',
    u32(0), new Uint8Array(4), // version + flags + pre_defined
    fourCC(handlerType),
    new Uint8Array(12),        // reserved
    u8(0)                      // name（空字符串，null 结尾）
  );
}

function dinf() {
  return box('dinf', box('dref',
    u32(0),            // version + flags
    u32(1),            // entry_count
    box('url ', u32(0x000001)) // self-contained，flags=1
  ));
}

/** avcC：WebCodecs 给的 description 通常是裸的 AVCDecoderConfigurationRecord，
    少数实现会直接返回完整 box，两种都兼容掉 */
function avcC(description) {
  const d = description || new Uint8Array(0);
  if (d.length > 4 && d[0] === 0x61 && d[1] === 0x76 && d[2] === 0x63 && d[3] === 0x43) return d;
  return box('avcC', d);
}

function avc1Entry(width, height, description) {
  return box('avc1',
    new Uint8Array(6),  // reserved
    u16(1),             // data_reference_index
    u16(0), u16(0),     // pre_defined, reserved
    new Uint8Array(12), // pre_defined
    u16(width), u16(height),
    fp16(72), fp16(72), // 72 dpi
    new Uint8Array(4),  // reserved
    u16(1),             // frame_count
    new Uint8Array(32), // compressorname（全 0 即空串）
    u16(0x0018),        // depth 24
    u16(0xffff),        // pre_defined
    avcC(description)
  );
}

function esds(description, bitrate) {
  const dsi = descriptor(0x05, description || new Uint8Array(0));
  const decoderConfig = descriptor(0x04,
    u8(0x40),                 // objectTypeIndication: MPEG-4 audio
    u8((0x05 << 2) | 0x01),   // streamType=Audio(5), upStream=0, reserved=1
    u24(0),                   // bufferSizeDB
    u32(bitrate),             // maxBitrate
    u32(bitrate),             // avgBitrate
    dsi
  );
  const sl = descriptor(0x06, u8(2)); // SLConfigDescriptor，MP4 里固定 predefined=2
  return box('esds', u32(0), descriptor(0x03, u16(0), u8(0), decoderConfig, sl));
}

function mp4aEntry(channels, sampleRate, description, bitrate) {
  return box('mp4a',
    new Uint8Array(6),  // reserved
    u16(1),             // data_reference_index
    u16(0),             // version
    u16(0),             // revision
    new Uint8Array(4),  // vendor
    u16(channels),
    u16(16),            // sample size
    u16(0), u16(0),     // pre_defined, reserved
    fp16(sampleRate),
    esds(description, bitrate)
  );
}

function stsd(entry) {
  return box('stsd', u32(0), u32(1), entry);
}

/** 把连续的相同 delta 合并成一条，避免 5000 帧写出 5000 条 */
function stts(deltas) {
  const entries = [];
  for (const d of deltas) {
    const last = entries[entries.length - 1];
    if (last && last[1] === d) last[0]++;
    else entries.push([1, d]);
  }
  return box('stts', u32(0), u32(entries.length),
    concat(...entries.flatMap(([count, delta]) => [u32(count), u32(delta)])));
}

function stsc(count) {
  // 每个 chunk 存一个 sample：offset 表会大一些，但省掉了 chunk 内偏移换算
  return count === 0
    ? box('stsc', u32(0), u32(0))
    : box('stsc', u32(0), u32(1), u32(1), u32(1), u32(1));
}

function stsz(sizes) {
  return box('stsz', u32(0), u32(0), u32(sizes.length),
    concat(...sizes.map(s => u32(s))));
}

function co64(offsets) {
  return box('co64', u32(0), u32(offsets.length), concat(...offsets.map(o => u64(o))));
}

function stss(keyframeNumbers) {
  if (!keyframeNumbers.length) return null;
  return box('stss', u32(0), u32(keyframeNumbers.length),
    concat(...keyframeNumbers.map(n => u32(n))));
}

function stbl({ entry, deltas, sizes, keyframes, offsets }) {
  const sync = stss(keyframes);
  const parts = [stsd(entry), stts(deltas), stsc(sizes.length), stsz(sizes)];
  if (sync) parts.push(sync);
  parts.push(co64(offsets));
  return box('stbl', ...parts);
}

/* ---------------- 对外接口 ---------------- */

/**
 * @param {object} args
 * @param {{codecDescription:Uint8Array,width:number,height:number,frameRate:number,
 *          samples:{data:Uint8Array,isKey:boolean}[],bitrate:number}} args.video
 * @param {?{codecDescription:Uint8Array,sampleRate:number,channels:number,
 *          samples:{data:Uint8Array,duration:number}[],bitrate:number}} args.audio
 * @returns {Blob}
 */
export function buildMp4({ video, audio }) {
  if (!video || !video.samples || !video.samples.length) {
    throw new Error('没有视频帧，无法封装 MP4。');
  }
  const movieTimescale = MOVIE_TIMESCALE;

  const vTimescale = videoTimescale(video.frameRate);
  const videoSamples = video.samples.map(s => ({ track: 0, data: s.data, isKey: !!s.isKey, delta: VIDEO_SAMPLE_DELTA }));
  const videoDurationUs = videoSamples.length * VIDEO_SAMPLE_DELTA * 1e6 / vTimescale;
  // 以视频为主时间轴：音频多出来的尾部一律裁掉。
  // 否则音频比画面长时，画面播完声音还在响，观感就是「声音在画面之后才出现」。
  let audioSamples = (audio && audio.samples && audio.samples.length)
    ? audio.samples.map(s => ({ track: 1, data: s.data, delta: s.duration || AAC_FRAME_SAMPLES }))
    : [];

  if (audioSamples.length) {
    const kept = [];
    let accUs = 0;
    for (const s of audioSamples) {
      if (accUs >= videoDurationUs) break;
      accUs += s.delta * 1e6 / audio.sampleRate;
      kept.push(s);
    }
    audioSamples = kept;
  }
  const hasAudio = audioSamples.length > 0;

  // 音视频交错：按各自时长换算到微秒排序，避免音频全堆在文件末尾导致播放器缓冲吃力
  const totalVideo = videoSamples.length;
  const ordered = [];
  const videoOrder = videoSamples.map((s, i) => ({ s, i, us: i * 1e6 / movieTimescale }));
  let accSamples = 0;
  const audioOrder = audioSamples.map(s => {
    const us = accSamples * 1e6 / audio.sampleRate;
    accSamples += s.delta;
    return { s, us };
  });
  let vi = 0, ai = 0;
  while (vi < videoOrder.length || ai < audioOrder.length) {
    if (ai >= audioOrder.length || (vi < videoOrder.length && videoOrder[vi].us <= audioOrder[ai].us)) {
      ordered.push(videoOrder[vi++].s);
    } else {
      ordered.push(audioOrder[ai++].s);
    }
  }

  const videoDuration = totalVideo * VIDEO_SAMPLE_DELTA;   // 视频轨自身时间基准下
  const audioTotalSamples = audioSamples.reduce((n, s) => n + s.delta, 0);
  const videoSeconds = totalVideo / video.frameRate;
  // 总时长以视频为准（画面是主体），音频已被裁到不超过它
  const movieDuration = Math.round(videoSeconds * movieTimescale);

  const trackOf = t => {
    const samples = ordered.filter(s => s.track === t);
    return {
      sizes: samples.map(s => s.data.length),
      deltas: samples.map(s => s.delta),
      keyframes: t === 0
        ? samples.map((s, i) => (s.isKey ? i + 1 : 0)).filter(Boolean)
        : []
    };
  };
  const vTrack = trackOf(0);
  const aTrack = hasAudio ? trackOf(1) : null;

  const buildMoov = offsets => {
    const vOffsets = offsets.filter((_, i) => ordered[i].track === 0);
    const aOffsets = hasAudio ? offsets.filter((_, i) => ordered[i].track === 1) : [];

    const vTrak = box('trak',
      // tkhd 用 movie 基准（毫秒），mdhd 用轨道自身基准
      tkhd(1, movieDuration, video.width, video.height, false),
      box('mdia',
        mdhd(vTimescale, videoDuration),
        hdlr('vide'),
        box('minf',
          box('vmhd', u32(1), u16(0), u16(0), u16(0), u16(0)),
          dinf(),
          stbl({
            entry: avc1Entry(video.width, video.height, video.codecDescription),
            deltas: vTrack.deltas, sizes: vTrack.sizes,
            keyframes: vTrack.keyframes, offsets: vOffsets
          })
        )
      )
    );

    if (!hasAudio) return box('moov', mvhd(movieTimescale, movieDuration, 2), vTrak);

    const aDurationInMovie = Math.round(audioTotalSamples * movieTimescale / audio.sampleRate);
    const aTrak = box('trak',
      tkhd(2, aDurationInMovie, 0, 0, true),
      box('mdia',
        mdhd(audio.sampleRate, audioTotalSamples),
        hdlr('soun'),
        box('minf',
          box('smhd', u32(0), u16(0), u16(0)),
          dinf(),
          stbl({
            entry: mp4aEntry(audio.channels, audio.sampleRate, audio.codecDescription, audio.bitrate || 0),
            deltas: aTrack.deltas, sizes: aTrack.sizes,
            keyframes: [], offsets: aOffsets
          })
        )
      )
    );
    return box('moov', mvhd(movieTimescale, movieDuration, 3), vTrak, aTrak);
  };

  // 两遍构建：offset 条目数固定，所以第一遍算出的 moov 大小就是最终大小
  const probeOffsets = ordered.map(() => 0);
  const moovSize = buildMoov(probeOffsets).length;
  const mdatHeaderSize = 8;
  const dataStart = ftyp().length + moovSize + mdatHeaderSize;

  const offsets = [];
  let cursor = dataStart;
  for (const s of ordered) { offsets.push(cursor); cursor += s.data.length; }
  const mdatPayloadSize = cursor - dataStart;

  const ftypBox = ftyp();
  const moovBox = buildMoov(offsets);
  if (moovBox.length !== moovSize) {
    throw new Error('MP4 封装校验失败：moov 大小在回填偏移后发生变化。');
  }

  const mdatHeader = new Uint8Array(mdatHeaderSize);
  new DataView(mdatHeader.buffer).setUint32(0, mdatHeaderSize + mdatPayloadSize);
  mdatHeader.set(str4('mdat'), 4);

  return new Blob([ftypBox, moovBox, mdatHeader, ...ordered.map(s => s.data)], { type: 'video/mp4' });
}
