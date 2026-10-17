// 把仓库根目录的静态页面 / 数据文件复制进构建产物，
// 让本地 npm run build 得到的 dist 与 GitHub Actions 线上产物一致。
import { copyFileSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = join(here, 'dist');

mkdirSync(dist, { recursive: true });

const files = [
    'quiz.html',
    'home.html',
    'philzy.html',
    'pmth.html',
    'pcd.data',
    'dl.data',
    'lz.data',
    'CNAME',
    'README.md',
];

for (const name of files) {
    const src = join(root, name);
    if (!existsSync(src)) {
        console.warn(`[copy-static] 跳过缺失文件：${name}`);
        continue;
    }
    copyFileSync(src, join(dist, name));
    console.log(`[copy-static] ${name}`);
}

const jpgDir = join(root, 'jpg');
if (existsSync(jpgDir)) {
    cpSync(jpgDir, join(dist, 'jpg'), { recursive: true });
    console.log('[copy-static] jpg/');
}

console.log('[copy-static] 完成，产物位于 Download/dist');
