import { Panel } from "@/components/screens/Scene";
import { StoryButton, StoryText } from "@/design";

export function DemoPanel({ isDemo, busy, error, onRestart, onStop, onClose }: {
  isDemo: boolean;
  busy: boolean;
  error: string;
  onRestart: () => void;
  onStop: () => void;
  onClose: () => void;
}) {
  return <Panel title="Demo tools." onClose={onClose}>
    <StoryText color="#f6efe6">A separate sample world for showing the daily ritual. No real charge or donation is made.</StoryText>
    <StoryText variant="caption" color="#c6c1c2">Yesterday has 40 sample answerers and 12 waterers. Your sample giving spans exactly three prior days. Answer today, then water before or after bloom.</StoryText>
    <StoryButton label={isDemo ? "Restart sample day" : "Start sample day"} loading={busy} onPress={onRestart} />
    {isDemo && <StoryButton label="Return to the real day" tone="quiet" loading={busy} onPress={onStop} />}
    {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
  </Panel>;
}
