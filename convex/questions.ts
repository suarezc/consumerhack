export const questions = [
  "What small thing made today feel a little softer?",
  "Who taught you a kindness you still remember?",
  "When did you last feel understood?",
  "What gave you a little courage recently?",
  "What is a small way someone showed up for you?",
  "What part of yourself deserves a gentler voice?",
  "What would you tell a friend having your kind of day?",
  "What helps you feel safe enough to ask for support?",
  "When has someone made you feel that you belong?",
  "What is one kind thing you could do for yourself today?",
  "What small kindness would you like a child to experience?",
  "Who makes it easier for you to be yourself?",
  "What helps you find calm on a difficult day?",
  "When did a simple check-in mean more than someone knew?",
  "What would a kinder school day have looked like for you?",
  "What is a gentle way to include someone who feels left out?",
  "What feeling would you like to make a little more room for?",
  "What has helped you feel less alone?",
  "What is something you wish more people understood about you?",
  "How has a small act of care stayed with you?",
  "What does being a good listener look like to you?",
  "What gives you hope for the young people in your life?",
  "What kind words have you needed to hear lately?",
  "What is one way your community could care for its children?",
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
