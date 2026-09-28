/**
 * 极简 QR 码生成器（自包含，不依赖任何第三方库）
 *
 * 只实现「字节模式 + 版本 1~10」，对分享链接（通常 40~80 字节）完全够用，
 * 相比引入 qrcode.js 省掉一个依赖，也让离线构建更稳。
 *
 * 算法参考 QR Code ISO/IEC 18004 标准实现（Reed-Solomon + 掩码评分）。
 */

type int = number;

// 每个版本、每个纠错等级下「每块的纠错码字数」
const ECC_CODEWORDS_PER_BLOCK: ReadonlyArray<ReadonlyArray<int>> = [
    //  0,   1,  2,  3,  4,  5,  6,  7,  8,  9, 10
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], // L
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], // M
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24], // Q
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28], // H
];

// 每个版本、每个纠错等级下「纠错块数量」
const NUM_ERROR_CORRECTION_BLOCKS: ReadonlyArray<ReadonlyArray<int>> = [
    //  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4], // L
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5], // M
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8], // Q
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8], // H
];

// 纠错等级对应的格式信息位
const FORMAT_BITS: ReadonlyArray<int> = [1, 0, 3, 2]; // L, M, Q, H

export type EccLevel = 'L' | 'M' | 'Q' | 'H';
const ECC_ORDINAL: Record<EccLevel, int> = { L: 0, M: 1, Q: 2, H: 3 };

const MIN_VERSION = 1;
const MAX_VERSION = 10;

/** 该版本下可用于存放数据+纠错的bit总数 */
function getNumRawDataModules(ver: int): int {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7) result -= 36;
    }
    return result;
}

/** 该版本该纠错等级下，纯数据码字数量 */
function getNumDataCodewords(ver: int, ecl: int): int {
    return (
        Math.floor(getNumRawDataModules(ver) / 8) -
        ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
    );
}

function getBit(x: int, i: int): boolean {
    return ((x >>> i) & 1) !== 0;
}

// ---- Reed-Solomon (GF(2^8)) ----

function reedSolomonMultiply(x: int, y: int): int {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
}

function reedSolomonComputeDivisor(degree: int): Array<int> {
    const result = new Array<int>(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
            result[j] = reedSolomonMultiply(result[j], root);
            if (j + 1 < result.length) result[j] ^= result[j + 1];
        }
        root = reedSolomonMultiply(root, 0x02);
    }
    return result;
}

function reedSolomonComputeRemainder(data: ReadonlyArray<int>, divisor: ReadonlyArray<int>): Array<int> {
    const result = divisor.map(() => 0);
    for (const b of data) {
        const factor = b ^ (result.shift() as int);
        result.push(0);
        divisor.forEach((d, i) => {
            result[i] ^= reedSolomonMultiply(d, factor);
        });
    }
    return result;
}

/** 把若干位追加到 bit 缓冲（每字节高位在前） */
function appendBits(val: int, len: int, bb: Array<int>): void {
    for (let i = len - 1; i >= 0; i--) {
        bb.push((val >>> i) & 1);
    }
}

function bitsToBytes(bb: ReadonlyArray<int>): Array<int> {
    const out: Array<int> = [];
    for (let i = 0; i < bb.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) {
            b = (b << 1) | (bb[i + j] || 0);
        }
        out.push(b & 0xff);
    }
    return out;
}

class QrCode {
    public readonly size: int;
    private readonly modules: Array<Array<boolean>>;
    private readonly isFunction: Array<Array<boolean>>;

    public constructor(public readonly version: int, eclOrdinal: int, dataCodewords: ReadonlyArray<int>) {
        this.size = version * 4 + 17;
        this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
        this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));

        this.drawFunctionPatterns(eclOrdinal);
        const allCodewords = this.addEccAndInterleave(dataCodewords, eclOrdinal);
        this.drawCodewords(allCodewords);

        // 选一个 penalty 最低的掩码，提高可读性
        let bestMask = 0;
        let bestPenalty = Infinity;
        for (let mask = 0; mask < 8; mask++) {
            this.applyMask(mask);
            this.drawFormatBits(eclOrdinal, mask);
            const p = this.getPenaltyScore();
            if (p < bestPenalty) {
                bestPenalty = p;
                bestMask = mask;
            }
            this.applyMask(mask); // 异或两次 = 撤销
        }
        this.applyMask(bestMask);
        this.drawFormatBits(eclOrdinal, bestMask);
    }

    public getModule(x: int, y: int): boolean {
        return this.modules[y][x];
    }

    private setFunctionModule(x: int, y: int, isDark: boolean): void {
        this.modules[y][x] = isDark;
        this.isFunction[y][x] = true;
    }

    private drawFinderPattern(x: int, y: int): void {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                const xx = x + dx;
                const yy = y + dy;
                if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
                    this.setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
                }
            }
        }
    }

    private drawAlignmentPattern(x: int, y: int): void {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
        }
    }

    private drawFormatBits(eclOrdinal: int, mask: int): void {
        const data = (FORMAT_BITS[eclOrdinal] << 3) | mask;
        let rem = data;
        for (let i = 0; i < 10; i++) {
            rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        }
        const bits = (((data << 10) | rem) ^ 0x5412) & 0x7fff;

        // 第一份副本
        for (let i = 0; i <= 5; i++) this.setFunctionModule(8, i, getBit(bits, i));
        this.setFunctionModule(8, 7, getBit(bits, 6));
        this.setFunctionModule(8, 8, getBit(bits, 7));
        this.setFunctionModule(7, 8, getBit(bits, 8));
        for (let i = 9; i < 15; i++) this.setFunctionModule(14 - i, 8, getBit(bits, i));

        // 第二份副本
        for (let i = 0; i < 8; i++) this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
        for (let i = 8; i < 15; i++) this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
        this.setFunctionModule(8, this.size - 8, true);
    }

    private drawVersionBits(): void {
        if (this.version < 7) return;
        let rem = this.version;
        for (let i = 0; i < 12; i++) {
            rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
        }
        const bits = (this.version << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const bit = getBit(bits, i);
            const a = this.size - 11 + (i % 3);
            const b = Math.floor(i / 3);
            this.setFunctionModule(a, b, bit);
            this.setFunctionModule(b, a, bit);
        }
    }

    private drawFunctionPatterns(eclOrdinal: int): void {
        // 时序图案
        for (let i = 0; i < this.size; i++) {
            this.setFunctionModule(6, i, i % 2 === 0);
            this.setFunctionModule(i, 6, i % 2 === 0);
        }
        // 定位图案
        this.drawFinderPattern(3, 3);
        this.drawFinderPattern(this.size - 4, 3);
        this.drawFinderPattern(3, this.size - 4);

        // 校正图案
        const pos = this.getAlignmentPatternPositions();
        const n = pos.length;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const isCorner = (i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0);
                if (!isCorner) this.drawAlignmentPattern(pos[i], pos[j]);
            }
        }

        this.drawFormatBits(eclOrdinal, 0);
        this.drawVersionBits();
    }

    private getAlignmentPatternPositions(): Array<int> {
        if (this.version === 1) return [];
        const numAlign = Math.floor(this.version / 7) + 2;
        const step = Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
        const result: Array<int> = [6];
        for (let pos = this.size - 7; result.length < numAlign; pos -= step) {
            result.splice(1, 0, pos);
        }
        return result;
    }

    private addEccAndInterleave(data: ReadonlyArray<int>, eclOrdinal: int): Array<int> {
        const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[eclOrdinal][this.version];
        const blockEccLen = ECC_CODEWORDS_PER_BLOCK[eclOrdinal][this.version];
        const rawCodewords = Math.floor(getNumRawDataModules(this.version) / 8);
        const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
        const shortBlockLen = Math.floor(rawCodewords / numBlocks);

        const blocks: Array<Array<int>> = [];
        const rsDiv = reedSolomonComputeDivisor(blockEccLen);
        let k = 0;
        for (let i = 0; i < numBlocks; i++) {
            const len = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
            const dat = data.slice(k, k + len);
            k += dat.length;
            const ecc = reedSolomonComputeRemainder(dat, rsDiv);
            const block = dat.slice();
            if (i < numShortBlocks) block.push(0);
            blocks.push(block.concat(ecc));
        }

        const result: Array<int> = [];
        for (let i = 0; i < blocks[0].length; i++) {
            blocks.forEach((block, j) => {
                // 短块没有这一位，跳过
                if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
                    result.push(block[i]);
                }
            });
        }
        return result;
    }

    private drawCodewords(data: ReadonlyArray<int>): void {
        let i = 0;
        for (let right = this.size - 1; right >= 1; right -= 2) {
            if (right === 6) right = 5; // 跳过竖直时序列
            for (let vert = 0; vert < this.size; vert++) {
                for (let j = 0; j < 2; j++) {
                    const x = right - j;
                    const upward = ((right + 1) & 2) === 0;
                    const y = upward ? this.size - 1 - vert : vert;
                    if (!this.isFunction[y][x] && i < data.length * 8) {
                        this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
                        i++;
                    }
                }
            }
        }
    }

    private applyMask(mask: int): void {
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                let invert: boolean;
                switch (mask) {
                    case 0: invert = (x + y) % 2 === 0; break;
                    case 1: invert = y % 2 === 0; break;
                    case 2: invert = x % 3 === 0; break;
                    case 3: invert = (x + y) % 3 === 0; break;
                    case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
                    case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
                    case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
                    case 7: invert = ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0; break;
                    default: throw new Error('非法掩码');
                }
                if (!this.isFunction[y][x] && invert) {
                    this.modules[y][x] = !this.modules[y][x];
                }
            }
        }
    }

    /** 可读性惩罚分（越低越好），取标准中的主要三条规则 */
    private getPenaltyScore(): int {
        const size = this.size;
        let score = 0;

        // 规则 1：同色连续 5 个及以上
        const scoreRun = (runColor: boolean, runLen: int): void => {
            if (runLen >= 5) score += 3 + (runLen - 5);
        };
        for (let y = 0; y < size; y++) {
            let runColor = false;
            let runLen = 0;
            for (let x = 0; x < size; x++) {
                const c = this.modules[y][x];
                if (x === 0 || c !== runColor) {
                    if (x > 0) scoreRun(runColor, runLen);
                    runColor = c;
                    runLen = 1;
                } else runLen++;
            }
            scoreRun(runColor, runLen);
        }
        for (let x = 0; x < size; x++) {
            let runColor = false;
            let runLen = 0;
            for (let y = 0; y < size; y++) {
                const c = this.modules[y][x];
                if (y === 0 || c !== runColor) {
                    if (y > 0) scoreRun(runColor, runLen);
                    runColor = c;
                    runLen = 1;
                } else runLen++;
            }
            scoreRun(runColor, runLen);
        }

        // 规则 2：2x2 同色块
        for (let y = 0; y < size - 1; y++) {
            for (let x = 0; x < size - 1; x++) {
                const c = this.modules[y][x];
                if (c === this.modules[y][x + 1] && c === this.modules[y + 1][x] && c === this.modules[y + 1][x + 1]) {
                    score += 3;
                }
            }
        }

        // 规则 4：黑白比例偏离 50%
        let dark = 0;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (this.modules[y][x]) dark++;
            }
        }
        const total = size * size;
        const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
        score += k * 10;

        return score;
    }
}

export interface QrMatrix {
    size: number;
    get(x: number, y: number): boolean;
}

/**
 * 生成文本（URL）对应的二维码矩阵。
 * 自动选择能容纳内容的最小版本；内容过长时抛出错误。
 */
export function makeQrMatrix(text: string, ecl: EccLevel = 'M'): QrMatrix {
    const bytes: Array<int> = [];
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code > 0xff) throw new Error('二维码内容只支持单字节字符');
        bytes.push(code);
    }
    // UTF-8 更安全：先编码成字节
    const utf8 = Array.from(new TextEncoder().encode(text));

    const eclOrdinal = ECC_ORDINAL[ecl];
    for (let ver = MIN_VERSION; ver <= MAX_VERSION; ver++) {
        const capacityBits = getNumDataCodewords(ver, eclOrdinal) * 8;
        const ccBits = ver <= 9 ? 8 : 16;
        const used = 4 + ccBits + utf8.length * 8;
        if (used > capacityBits) continue;

        const bb: Array<int> = [];
        appendBits(0b0100, 4, bb); // 字节模式
        appendBits(utf8.length, ccBits, bb);
        utf8.forEach(b => appendBits(b, 8, bb));
        // 终止符 + 补齐到字节边界
        appendBits(0, Math.min(4, capacityBits - bb.length), bb);
        appendBits(0, (8 - (bb.length % 8)) % 8, bb);
        // 填充字节 0xEC / 0x11 交替
        for (let pad = 0xec; bb.length < capacityBits; pad ^= 0xec ^ 0x11) {
            appendBits(pad, 8, bb);
        }

        const qr = new QrCode(ver, eclOrdinal, bitsToBytes(bb));
        return { size: qr.size, get: (x: number, y: number) => qr.getModule(x, y) };
    }
    throw new Error('内容过长，二维码无法容纳');
}

/** 把二维码画到 canvas 上（scale = 每个模块多少像素） */
export function drawQrToCanvas(
    ctx: CanvasRenderingContext2D,
    matrix: QrMatrix,
    x: number,
    y: number,
    moduleSize: number,
    dark: string,
    light: string
): void {
    const total = matrix.size * moduleSize;
    ctx.fillStyle = light;
    ctx.fillRect(x, y, total, total);
    ctx.fillStyle = dark;
    for (let my = 0; my < matrix.size; my++) {
        for (let mx = 0; mx < matrix.size; mx++) {
            if (matrix.get(mx, my)) {
                ctx.fillRect(x + mx * moduleSize, y + my * moduleSize, moduleSize, moduleSize);
            }
        }
    }
}
