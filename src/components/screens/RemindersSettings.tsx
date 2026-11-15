import { View } from "react-native";

import { StoryButton, StoryText } from "@/design";
import { useReminders } from "@/providers/NotificationProvider";

export function RemindersSettings() {
  const { status, busy, lastAction, update } = useReminders();
  const message = busy && lastAction === "out" ? "Turning off reminders… waiting for server confirmation."
    : !status ? "Checking reminder settings…"
    : status.state === "off" ? "Reminders are off."
    : status.state === "registered" ? "This device is registered for reminders. Registration is not a delivery confirmation."
    : status.state === "denied" ? "Notifications are denied in system settings. You can allow them there, then check again."
    : status.state === "unavailable" ? "Push reminders aren’t available in this build. No remote delivery has been verified."
    : status.state === "permission_required" ? "Allow notifications to receive a quiet reminder after bloom when your giving streak is at risk."
    : status.state === "registration_failed" ? "This device couldn’t register for reminders. No usable push token was retained."
    : lastAction === "out" ? "Turning off reminders could not be confirmed. Reconnect and try again."
    : "Reminder settings couldn’t be confirmed. Reconnect and try again.";

  return <View style={{ gap: 12 }}>
    <StoryText variant="meta" color="#f6efe6">Watering reminders</StoryText>
    <StoryText variant="caption" color="#c6c1c2" accessibilityLiveRegion="polite">{message}</StoryText>
    <StoryText variant="caption" color="#c6c1c2">Optional. After bloom, a reminder can help you continue yesterday’s giving streak. Demo days never send reminders.</StoryText>
    {status && status.state !== "registered" && <StoryButton
      label={status.state === "denied" || status.state === "sync_failed" ? "Check reminder settings" : "Allow reminders"}
      loading={busy && lastAction !== "out"} disabled={busy && lastAction === "out"}
      onPress={() => { void update(status.state === "denied" || status.state === "sync_failed" ? "retry" : "in"); }} />}
    {(!status || status.optIn || busy || status.state === "sync_failed") && <StoryButton label="Turn reminders off" tone="quiet"
      loading={busy && lastAction === "out"} onPress={() => { void update("out"); }} />}
  </View>;
}
