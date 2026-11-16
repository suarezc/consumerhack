import { useQuery } from "convex/react";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SessionGate } from "@/components/screens/Screen";
import { StoryText } from "@/design";
import { GroveHillside } from "@/design/presentations";
import { useRitual } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";

export default function Grove() {
  return <SessionGate requireTree><GroveDays /></SessionGate>;
}

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function GroveDays() {
  const { session } = useSession();
  const { today } = useRitual();
  const days = useQuery(api.days.grove, session?.treeId ? { deviceId: session.deviceId, treeId: session.treeId as Id<"trees"> } : "skip");
  const trees = [
    ...(today ? [{ id: today.day.dayId, label: "Today", question: today.day.question, answers: today.answerCount,
      missed: !today.myAnswer, fruits: today.fruits.filter((fruit) => fruit.isMine) }] : []),
    ...(days ?? []).map((day) => {
      const [, month, date] = day.date.split("-").map(Number);
      return { id: day.dayId, label: months[month - 1] ? `${months[month - 1]} ${date}` : day.date, question: day.question,
        answers: day.answerCount, missed: !day.answered, fruits: day.fruits.filter((fruit) => fruit.isMine) };
    }),
  ];
  return <View nativeID="story-secondary-safe-area" style={{ flex: 1 }}>
    <StatusBar style="light" />
    <GroveHillside days={trees} emptyMessage={days === undefined ? "Finding the grove…" : "Past days will gather here, one tree for each."}
      header={<SafeAreaView edges={["top", "left", "right"]} style={{ paddingHorizontal: 24, paddingTop: 4 }}>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/today")} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
          <StoryText variant="control" color="#f6efe6">‹ Today</StoryText>
        </Pressable>
        <StoryText variant="question" color="#f6efe6" accessibilityRole="header">Days we’ve grown together.</StoryText>
      </SafeAreaView>} />
  </View>;
}
