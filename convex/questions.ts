export const questions = [
  "What small thing made today feel a little softer?",
  "What is a place you carry with you?",
  "Who taught you a kindness you still remember?",
  "What have you quietly been looking forward to?",
  "When did you last feel understood?",
  "What would you like to make more room for?",
  "What ordinary moment would you like to keep?",
  "What is something you are learning to let go of?",
  "What does home sound like to you?",
  "What gave you a little courage recently?",
  "What is a small way someone showed up for you?",
  "What part of yourself deserves a gentler voice?",
  "What would you tell a friend having your kind of day?",
  "What surprised you with its beauty today?",
];

export function ritualWindow(now: number) {
  const date = new Date(now - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const opensAt = Date.parse(`${date}T06:00:00Z`);
  return { date, opensAt, bloomAt: opensAt + 15 * 60 * 60 * 1000 };
}

export function questionFor(date: string) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return questions[((day % questions.length) + questions.length) % questions.length];
}
