
export interface BlacklistEntry {
  songId: string;
  difficulty: string;
  reason?: string;
}

export const blacklist: BlacklistEntry[] = [
  {
    songId: 'StardustRAY.kanonevsBlackY',
    difficulty: 'IN',
    reason: "该谱面会导致 Phira 在所有设备上按下「开始」后无响应。"
  },
  {
    songId:'彩.MisoilePunch',
    difficulty: 'IN',
    reason: "该谱面会导致 Phira 在所有设备上按下「开始」后无响应。"
  },
];

export const isBlacklisted = (songId: string, difficulty: string): BlacklistEntry | undefined => {
  return blacklist.find(entry => entry.songId === songId && entry.difficulty === difficulty);
};
