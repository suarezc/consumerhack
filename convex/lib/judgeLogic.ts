export const EMBEDDING_DIMENSIONS = 1536;

export type Assessment = { mood: number; embedding: number[] };

const feelings = [
  { words: ["grateful", "thankful", "kind", "love", "friend", "family"], mood: 0.8, reason: "You both find warmth in care and connection." },
  { words: ["hope", "hopeful", "begin", "new", "grow", "future"], mood: 0.6, reason: "You both leave room for a hopeful new beginning." },
  { words: ["quiet", "peace", "calm", "slow", "rest", "breathe"], mood: 0.3, reason: "You both make space for quiet and a gentler pace." },
  { words: ["miss", "sad", "loss", "lonely", "grief", "cry"], mood: -0.7, reason: "You both give an honest place to missing and tenderness." },
  { words: ["worry", "afraid", "fear", "anxious", "tired", "hard"], mood: -0.5, reason: "You both meet a difficult moment with honesty." },
  { words: ["joy", "happy", "laugh", "smile", "delight", "play"], mood: 0.9, reason: "You both notice the small things that bring joy." },
];

function tokens(text: string) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function hash(text: string) {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function stubAssessment(text: string): Assessment {
  const words = tokens(text);
  const embedding = Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  let mood = 0;
  let count = 0;
  for (const word of words.length ? words : ["quiet"]) {
    embedding[hash(word) % EMBEDDING_DIMENSIONS] += 1;
    feelings.forEach((feeling, index) => {
      if (feeling.words.includes(word)) {
        embedding[index] += 3;
        mood += feeling.mood;
        count += 1;
      }
    });
  }
  const norm = Math.hypot(...embedding);
  return { mood: count ? mood / count : 0, embedding: embedding.map((value) => value / norm) };
}

export function validAssessment(value: Assessment) {
  return Number.isFinite(value.mood) && value.mood >= -1 && value.mood <= 1 &&
    value.embedding.length === EMBEDDING_DIMENSIONS && value.embedding.every(Number.isFinite) &&
    value.embedding.some((component) => component !== 0);
}

export type MatchCandidate = Assessment & { answerId: string; treeId: string; text: string };

export function rankMatches(source: MatchCandidate, candidates: MatchCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (candidate.answerId === source.answerId || candidate.treeId === source.treeId ||
        seen.has(candidate.answerId) || !validAssessment(candidate)) return false;
    seen.add(candidate.answerId);
    return true;
  }).map((candidate) => {
    const dot = source.embedding.reduce((sum, value, index) => sum + value * candidate.embedding[index], 0);
    const similarity = dot / (Math.hypot(...source.embedding) * Math.hypot(...candidate.embedding));
    const shared = feelings.find((feeling) =>
      tokens(source.text).some((word) => feeling.words.includes(word)) &&
      tokens(candidate.text).some((word) => feeling.words.includes(word)));
    return {
      answerId: candidate.answerId,
      reason: shared?.reason ?? "Your answers carry a similar emotional tone, in your own different ways.",
      score: similarity * 0.8 + (1 - Math.abs(source.mood - candidate.mood) / 2) * 0.2,
    };
  }).sort((a, b) => b.score - a.score || a.answerId.localeCompare(b.answerId))
    .slice(0, 3).map(({ answerId, reason }) => ({ answerId, reason }));
}

export type JudgeDay = { _id: string; treeId: string; isDemo?: boolean; bloomedAt?: number };
export type JudgeTree = { _id: string; code: string; demoDayId?: string };

export function currentBloom(day: JudgeDay | null, tree: JudgeTree | null): boolean {
  return !!day && !!tree && day.treeId === tree._id && day.bloomedAt !== undefined &&
    (!day.isDemo || tree.demoDayId === day._id);
}

export function eligibleTarget(source: JudgeDay, target: JudgeDay | null, tree: JudgeTree | null) {
  if (!currentBloom(target, tree) || !target || !tree || target.treeId === source.treeId) return false;
  if (source.isDemo) return !!target.isDemo &&
    [0, 1, 2].some((index) => tree.code === fixtureCode(source._id, index));
  return !target.isDemo && !tree.code.startsWith("judge-fixture:");
}

export function fixtureCode(dayId: string, index: number) {
  return `judge-fixture:${dayId}:${index}`;
}
