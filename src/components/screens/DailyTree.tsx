import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { Panel, Scene, sceneStyles } from "@/components/screens/Scene";
import { LoadingDay, TreeNavigation } from "@/components/screens/Screen";
import { LanternComposer } from "@/components/screens/LanternComposer";
import { AnswerCard, StoryButton, StoryField, StoryText } from "@/design";
import { useRitual, type Today } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api, type Id } from "@/services/api";
import { mutationError } from "@/services/errors";
import { bloomLabel } from "@/services/ritual";

export function DailyTree({ bloom = false }: { bloom?: boolean }) {
  const { today } = useRitual();
  if (!today) return <LoadingDay />;
  return <DailyTreeContent key={today.day.dayId} today={today} bloom={bloom} />;
}

function DailyTreeContent({ today, bloom }: { today: Today; bloom: boolean }) {
  const { session, selectTree } = useSession();
  const { timeOfDay, now } = useRitual();
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
  const [lanternTarget, setLanternTarget] = useState<Id<"answers"> | null | undefined>(undefined);
  const unlocked = today.myAnswer !== null && today.day.bloomedAt !== undefined;
  const selected = unlocked ? today.answers.find((answer) => answer.blossom === selectedIndex) ?? null : null;
  const canAnswer = !today.myAnswer && today.day.bloomedAt === undefined && now >= today.day.opensAt && now < today.day.bloomAt;
  const notes = today.notes.map((item) => ({ from: item.fromBlossom, to: item.toBlossom, count: 1, own: item.fromMemberId === today.member.memberId }));

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

  const detail = unlocked ? `${today.answerCount} ${today.answerCount === 1 ? "blossom" : "blossoms"} · tap one to read` : `${today.answerCount} of ${today.memberCount} answered · ${today.day.isDemo ? "one-minute demo" : `bloom ${bloomLabel(today.day.bloomAt)} local time`}`;
  return <Scene timeOfDay={timeOfDay} title={today.day.question}
    meta={`StoryTime · ${today.tree.name}${today.day.isDemo ? " · sample day" : ""}`} detail={detail}
    onOpenTree={() => { setError(""); setSettings(true); }}
    tree={{ answers: today.answerCount, mine: today.myAnswer ? [today.myAnswer.blossom] : [], notes, lanterns: today.lanternCount, onTapBlossom: choose }}
    overlay={() => (
    <AnswerCard open={selected !== null} answer={selected && { id: selected.answerId, text: selected.text, author: selected.name, isMine: selected.memberId === today.member.memberId }}
      onClose={() => { if (!busy) { setSelectedIndex(null); setNoteComposer(false); setError(""); } }}
      onNote={() => { setNoteComposer(true); setNoteSent(false); }} noteLoading={busy} error={error}
      onLantern={today.tree.cause && selected ? () => setLanternTarget(selected.answerId) : undefined}>
      {selected && today.notes.filter((item) => item.answerId === selected.answerId).map((item) => <View key={item.noteId} style={sceneStyles.stack}>
        <StoryText variant="meta" color="#c6c1c2">Private · {item.fromMemberId === today.member.memberId ? "from you" : item.fromName}</StoryText>
        <StoryText color="#f6efe6">{item.text}</StoryText>
      </View>)}
      {noteSent && <StoryText color="#ffd27a">Your private note was sent.</StoryText>}
      {noteComposer && selected && <View style={sceneStyles.stack}>
        <StoryField label="A private note" value={note} onChangeText={setNote} multiline maxLength={1000} editable={!busy} />
        <StoryText variant="caption" color="#c6c1c2">Only you and the author can read this.</StoryText>
        <StoryButton label="Send privately" disabled={!note.trim()} loading={busy} onPress={() => {
          if (session && note.trim()) void run(() => sendNote({ deviceId: session.deviceId, answerId: selected.answerId, text: note.trim() }), () => { setNoteComposer(false); setNote(""); setNoteSent(true); });
        }} />
      </View>}
    </AnswerCard>
    )}>
    {today.day.isDemo && <StoryText variant="meta" color="#ffd27a">Demo day · sample answers join your real answer</StoryText>}
    {canAnswer && <StoryButton label="Add my answer" onPress={() => { setError(""); setComposer(true); }} />}
    {today.myAnswer && !unlocked && <StoryText color="#f6efe6">Your blossom is on the tree. The answers open when everyone has answered, or at bloom time.</StoryText>}
    {!today.myAnswer && !canAnswer && <StoryText color="#f6efe6">{now < today.day.opensAt ? "The question opens soon." : "This day has closed. Come back for tomorrow’s question."}</StoryText>}
    {unlocked && <StoryButton label={bloom ? "Read a blossom" : "The tree has bloomed"} onPress={() => {
      if (!bloom) router.replace("/bloom");
      else if (today.answers[0]) choose(today.answers[0].blossom);
    }} />}
    {today.tree.cause && <StoryText variant="caption" color="#f6efe6">{today.tree.cause.name} · ${(today.raisedCents / 100).toFixed(2)} raised · {today.lanternCount} paid lanterns</StoryText>}
    <TreeNavigation />
    {!!error && !composer && !selected && !settings && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
    {composer && <Panel title="What’s on your mind?" onClose={() => { if (!busy) setComposer(false); }}>
      <StoryField label="Your answer" value={draft} onChangeText={setDraft} multiline maxLength={2000} editable={!busy} style={{ minHeight: 140 }} />
      <StoryText variant="caption" color="#c6c1c2">One answer for this day. It opens to your circle at bloom, and may become a kindred answer on another tree.</StoryText>
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
      <StoryButton label="Let it blossom" disabled={!draft.trim()} loading={busy} onPress={() => {
        if (session && draft.trim()) void run(() => submitAnswer({ deviceId: session.deviceId, dayId: today.day.dayId, text: draft.trim() }), () => { setComposer(false); setDraft(""); });
      }} />
    </Panel>}
    {settings && <Panel title={today.tree.name} onClose={() => { if (!busy) setSettings(false); }}>
      <StoryText variant="meta" color="#f6efe6">Invite code · {today.tree.code}</StoryText>
      <StoryText color="#f6efe6">Share this code with your circle. Your anonymous identity is not part of the invite.</StoryText>
      {today.tree.cause && <StoryButton label="Hang a lantern · sandbox" onPress={() => { setSettings(false); setLanternTarget(null); }} />}
      {today.tree.isHost && <>
        <StoryText variant="caption" color="#c6c1c2">The one-minute demo adds clearly labelled sample answers. You still answer to unlock the bloom. A replay starts a fresh sample day.</StoryText>
        <StoryButton label={today.day.isDemo ? "Replay one-minute demo" : "Start one-minute demo"} loading={busy} onPress={() => {
          if (session) void run(() => restartDemo({ deviceId: session.deviceId, treeId: today.tree.treeId }), () => router.replace("/today"));
        }} />
        {today.day.isDemo && <StoryButton label="Return to the real day" tone="quiet" loading={busy} onPress={() => {
          if (session) void run(() => stopDemo({ deviceId: session.deviceId, treeId: today.tree.treeId }), () => router.replace("/today"));
        }} />}
      </>}
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
      <StoryButton label="Choose another tree" tone="quiet" loading={busy} onPress={() => {
        void run(() => selectTree(null), () => router.replace("/"));
      }} />
    </Panel>}
    {lanternTarget !== undefined && today.tree.cause && <LanternComposer treeId={today.tree.treeId}
      answerId={lanternTarget ?? undefined} cause={today.tree.cause.name} onClose={() => setLanternTarget(undefined)} />}
  </Scene>;
}
