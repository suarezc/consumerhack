import { useMutation } from "convex/react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { Panel, Scene, sceneStyles } from "@/components/screens/Scene";
import { DemoPanel } from "@/components/screens/DemoPanel";
import { LoadingDay, TreeNavigation } from "@/components/screens/Screen";
import { WateringComposer } from "@/components/screens/WateringComposer";
import { RemindersSettings } from "@/components/screens/RemindersSettings";
import { FruitDetailStatus } from "@/components/screens/FruitDetailStatus";
import { getTreeDataStatus } from "@/components/tree/bridge";
import { AnswerCard, CharityDetails, GivingFeedback, productSceneStyles, StoryButton, StoryField, StoryText, TodayCharitySummary, TodayStreaks, useStoryTime } from "@/design";
import { useRitual, type Today } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";
import { mutationError } from "@/services/errors";
import { bloomLabel } from "@/services/ritual";

export function DailyTree({ bloom = false }: { bloom?: boolean }) {
  const { today } = useRitual();
  if (!today) return <LoadingDay />;
  return <DailyTreeContent key={`${today.tree.treeId}:${today.day.dayId}`} today={today} bloom={bloom} />;
}

function DailyTreeContent({ today, bloom }: { today: Today; bloom: boolean }) {
  const { session, selectTree } = useSession();
  const { timeOfDay, now, watering, consumeGivingFeedback } = useRitual();
  const { theme } = useStoryTime();
  const submitAnswer = useMutation(api.answers.submit);
  const sendNote = useMutation(api.notes.send);
  const restartDemo = useMutation(api.demo.restart);
  const stopDemo = useMutation(api.demo.stop);
  const [composer, setComposer] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [noteComposer, setNoteComposer] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [settings, setSettings] = useState(false);
  const [demoSettings, setDemoSettings] = useState(false);
  const [wateringOpen, setWateringOpen] = useState(false);
  const [charityOpen, setCharityOpen] = useState(false);
  const unlocked = today.myAnswer !== null && today.day.bloomedAt !== undefined;
  const selected = unlocked ? today.answers.find((answer) => answer.blossom === selectedIndex) ?? null : null;
  const canAnswer = !today.myAnswer && today.day.bloomedAt === undefined && now >= today.day.opensAt && now < today.day.bloomAt;
  const notes = today.notes.map((item) => ({ from: item.fromBlossom, to: item.toBlossom, count: 1, own: item.fromMemberId === today.member.memberId }));
  const fruits = useMemo(() => today.fruits.map((fruit) => ({ id: fruit.fruitId, golden: false, mine: fruit.isMine })), [today.fruits]);
  const fruitStatus = getTreeDataStatus({ fruits });
  const detailUnavailable = fruitStatus.status === "unavailable";

  async function run(action: () => Promise<unknown>, after?: () => void) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      after?.();
    } catch (failure) {
      setError(mutationError(failure, "That didn’t reach the garden. Please try again."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function choose(index: number) {
    if (!unlocked || !today.answers.some((answer) => answer.blossom === index)) return;
    setSelectedIndex(index);
    setNoteComposer(false);
    setNoteSent(false);
    setNote("");
    setError("");
  }

  const detail = unlocked ? `${today.answerCount} ${today.answerCount === 1 ? "blossom" : "blossoms"} · tap one to read` : `${today.answerCount} of ${today.memberCount} answered${today.day.isDemo ? "" : ` · bloom ${bloomLabel(today.day.bloomAt)} local time`}`;
  return <Scene timeOfDay={timeOfDay} title={today.day.question}
    treeKey={`${today.tree.treeId}:${today.day.dayId}`}
    treeUnavailable={detailUnavailable}
    meta={`${bloom ? "Bloom" : "StoryTime"} · ${today.tree.name}${today.day.isDemo ? " · sample day" : ""}`} detail={detail}
    onOpenTree={() => { setError(""); setSettings(true); }}
    underQuestion={<View style={sceneStyles.stack}>
      <TodayCharitySummary charity={today.charity} totalRaisedCents={today.totalRaisedCents} isDemo={today.day.isDemo} onShowDetails={() => { setError(""); setCharityOpen(true); }} />
      <TodayStreaks compact summary={today.streaks} color={theme.text} />
      <FruitDetailStatus status={fruitStatus} fruitCount={fruits.length} />
    </View>}
    tree={{ answers: today.answerCount, mine: today.myAnswer ? [today.myAnswer.blossom] : [], notes, lanterns: 0, onTapBlossom: choose,
      fruits, lightBundles: today.lightBundles, goldenLightBundles: today.goldenLightBundles, lightEvent: watering.treeEvent }}
    overlay={(controlsHeight) => (
    <AnswerCard controlsHeight={controlsHeight} open={selected !== null} answer={selected && { id: selected.answerId, text: selected.text, author: selected.name, isMine: selected.memberId === today.member.memberId }}
      onClose={() => { if (!busy) { setSelectedIndex(null); setNoteComposer(false); setError(""); } }}
      onNote={() => { setNoteComposer(true); setNoteSent(false); }} noteLoading={busy} error={error}>
      {selected && today.notes.filter((item) => item.answerId === selected.answerId).map((item) => <View key={item.noteId} style={sceneStyles.stack}>
        <StoryText variant="meta" color="#c6c1c2">Private · {item.fromMemberId === today.member.memberId ? "from you" : item.fromName}</StoryText>
        <StoryText color="#f6efe6">{item.text}</StoryText>
      </View>)}
      {noteSent && <StoryText color="#ffd27a">Your private note was sent.</StoryText>}
      {noteComposer && selected && <View style={sceneStyles.stack}>
        <StoryField labelColor="#f6efe6" errorColor="#ffd27a" label="A private note" value={note} onChangeText={setNote} multiline maxLength={1000} editable={!busy} />
        <StoryText variant="caption" color="#c6c1c2">Only you and the author can read this.</StoryText>
        <StoryButton label="Send privately" disabled={!note.trim()} loading={busy} onPress={() => {
          if (session && note.trim()) void run(() => sendNote({ deviceId: session.deviceId, answerId: selected.answerId, text: note.trim() }), () => { setNoteComposer(false); setNote(""); setNoteSent(true); });
        }} />
      </View>}
      {selected && <StoryButton label="Water today's tree for S.A.C.K." onPress={() => { setSelectedIndex(null); setWateringOpen(true); }} />}
    </AnswerCard>
    )}>
    <GivingFeedback baselineId={watering.baselineId} event={watering.feedbackEvent} onConsumed={consumeGivingFeedback} color={detailUnavailable ? theme.text : theme.lantern} />
    {canAnswer && <StoryButton label="Leave your answer" style={productSceneStyles.primary} onPress={() => { setError(""); setComposer(true); }} />}
    {today.myAnswer && !unlocked && <StoryText variant="caption" color={detailUnavailable ? theme.text : theme.paper}>Your answer is planted.</StoryText>}
    {!today.myAnswer && !canAnswer && <StoryText color={detailUnavailable ? theme.text : theme.paper}>{now < today.day.opensAt ? "The question opens soon." : "This day has closed. Come back for tomorrow’s question."}</StoryText>}
    {today.tree.isHost && !today.myAnswer && !canAnswer && <StoryButton label={today.day.isDemo ? "Restart sample day" : "Start sample day"} tone="quiet" onPress={() => { setError(""); setDemoSettings(true); }} />}
    {today.myAnswer && <StoryButton label="Water today's tree for S.A.C.K." style={productSceneStyles.primary} onPress={() => setWateringOpen(true)} />}
    <TreeNavigation hill={!detailUnavailable} compact />
    {!!error && !composer && !selected && !settings && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
    {composer && <Panel title="What’s on your mind?" onClose={() => { if (!busy) setComposer(false); }}>
      <StoryField autoFocus labelColor="#f6efe6" errorColor="#ffd27a" label="Your answer" value={draft} onChangeText={setDraft} multiline maxLength={2000} editable={!busy} style={{ minHeight: 140 }} />
      <StoryText variant="caption" color="#c6c1c2">One answer for this day. It opens to your circle at bloom, and may become a kindred answer on another tree.</StoryText>
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
      <StoryButton label="Let it blossom" disabled={!draft.trim()} loading={busy} onPress={() => {
        if (session && draft.trim()) void run(() => submitAnswer({ deviceId: session.deviceId, dayId: today.day.dayId, text: draft.trim() }), () => { setComposer(false); setDraft(""); });
      }} />
    </Panel>}
    {settings && <Panel title={today.tree.name} onClose={() => { if (!busy) setSettings(false); }}>
      <StoryText variant="meta" color="#f6efe6">Invite code · {today.tree.code}</StoryText>
      <StoryText color="#f6efe6">Share this code with your circle. Your anonymous identity is not part of the invite.</StoryText>
      <RemindersSettings />
      <StoryButton label="Water today's tree for S.A.C.K." disabled={!today.myAnswer} onPress={() => { setSettings(false); setWateringOpen(true); }} />
      {today.tree.isHost && <StoryButton label="Demo tools" tone="quiet" onPress={() => { setSettings(false); setDemoSettings(true); }} />}
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
      <StoryButton label="Choose another tree" tone="quiet" loading={busy} onPress={() => {
        void run(() => selectTree(null), () => router.replace("/"));
      }} />
    </Panel>}
    {demoSettings && <DemoPanel isDemo={today.day.isDemo} busy={busy} error={error} onClose={() => { if (!busy) setDemoSettings(false); }}
      onRestart={() => { if (session) void run(() => restartDemo({ deviceId: session.deviceId, treeId: today.tree.treeId }), () => { setDemoSettings(false); router.replace("/today"); }); }}
      onStop={() => { if (session) void run(() => stopDemo({ deviceId: session.deviceId, treeId: today.tree.treeId }), () => { setDemoSettings(false); router.replace("/today"); }); }} />}
    {wateringOpen && <WateringComposer today={today} onClose={() => setWateringOpen(false)} />}
    {charityOpen && <Panel title="Today’s charity." onClose={() => setCharityOpen(false)}>
      <CharityDetails charity={today.charity} onOpenLink={(url) => {
        void WebBrowser.openBrowserAsync(url).catch(() => setError("The charity website couldn’t open. Please try again."));
      }} />
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
    </Panel>}
  </Scene>;
}
