
export interface PatchedChartEntry {
  songId: string;
  difficulty: string;
  url: string;
  fileName: string;
  reason?: string;
}

export const patchedCharts: PatchedChartEntry[] = [
  {
    songId: 'ハテ.rNFrums',
    difficulty: 'AT',
    url: 'https://raw.githubusercontent.com/swordalt/phigros-patched-charts/refs/heads/main/mainStory/%E3%83%8F%E3%83%86-AT-fixed.pez',
    fileName: 'ハテ-AT-fixed.pez',
    reason: '原版谱面缺少红键提示，实际无法正常游玩。此修复版将结尾附近的音符全部移到 Line 0，从根本上避开该问题。'
  }
];

export const getPatchedChart = (songId: string, difficulty: string): PatchedChartEntry | undefined => {
  return patchedCharts.find(entry => entry.songId === songId && entry.difficulty === difficulty);
};
