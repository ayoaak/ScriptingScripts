// Rank bands follow the user-provided Battlefield Wiki table. Images live on GitHub.
export const RANK_IMAGE_BASE = "https://raw.githubusercontent.com/ayoaak/ScriptingScripts/main/Battlefield1Stats/assets/ranks/";
export const RANK_BANDS = [
  { min: 0, max: 0, title: "新兵", english: "Recruit" },
  { min: 1, max: 9, title: "列兵", english: "Private" },
  { min: 10, max: 19, title: "下士", english: "Corporal" },
  { min: 20, max: 29, title: "中士", english: "Sergeant" },
  { min: 30, max: 39, title: "军士长", english: "Sergeant Major" },
  { min: 40, max: 49, title: "军校生", english: "Officer Cadet" },
  { min: 50, max: 59, title: "少尉", english: "Second Lieutenant" },
  { min: 60, max: 69, title: "中尉", english: "First Lieutenant" },
  { min: 70, max: 79, title: "上尉", english: "Captain" },
  { min: 80, max: 89, title: "少校", english: "Major" },
  { min: 90, max: 99, title: "中校", english: "Lieutenant Colonel" },
  { min: 100, max: 109, title: "上校", english: "Colonel" },
  { min: 110, max: 119, title: "准将", english: "Brigadier General" },
  { min: 120, max: 129, title: "少将", english: "Major General" },
  { min: 130, max: 139, title: "中将", english: "Lieutenant General" },
  { min: 140, max: 149, title: "上将", english: "General" },
  { min: 150, max: 150, title: "五星上将", english: "Five-Star General" },
] as const;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export function getRank(rank?: number) {
  if (rank === undefined || !Number.isInteger(rank)) return undefined;
  const band = RANK_BANDS.find(item => rank >= item.min && rank <= item.max);
  if (!band) return undefined;
  const ordinal = rank - band.min + 1;
  const suffix = ordinal > 1 ? ` ${ROMAN[ordinal - 1]}` : "";
  const file = `rank-${String(band.min).padStart(3, "0")}.png`;
  return { level: rank, title: band.title + suffix, english: band.english + suffix, imageUrl: RANK_IMAGE_BASE + file, file };
}

export function moveCard(index: number, count: number, direction: number): number {
  if (count <= 0) return 0;
  return ((index + direction) % count + count) % count;
}
export function swipeDirection(x: number, y: number, velocityY = 0): -1 | 0 | 1 {
  if (![x, y, velocityY].every(Number.isFinite) || Math.abs(y) <= Math.abs(x)) return 0;
  if (Math.abs(y) < 44 && !(Math.abs(y) >= 18 && Math.abs(velocityY) >= 450 && Math.sign(y) === Math.sign(velocityY))) return 0;
  return y < 0 ? 1 : -1;
}
