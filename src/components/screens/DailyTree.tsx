import { useMutation } from "convex/react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { Share, View } from "react-native";

import { Panel, Scene, sceneStyles } from "@/components/screens/Scene";
import { LoadingDay, TreeNavigation } from "@/components/screens/Screen";
import { WateringComposer } from "@/components/screens/WateringComposer";
import { RemindersSettings } from "@/components/screens/RemindersSettings";
import { FruitDetailStatus } from "@/components/screens/FruitDetailStatus";
import { getTreeDataStatus } from "@/components/tree/bridge";
import { AnswerCard, CharityDetails, GivingFeedback, productSceneStyles, StoryButton, StoryField, StoryText, StoryTimeProvider, themeAt, TodayCharitySummary, TodayStreaks, useStoryTime } from "@/design";
import { useRitual, type Today } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";
import { mutationError } from "@/services/errors";
import { bloomLabel } from "@/services/ritual";

const launch = { fresh: true };

export function DailyTree({ bloom = false }: { bloom?: boolean }) {
  const { today } = useRitual();
  if (!today) return <LoadingDay />;
  return <DailyTreeContent key={`${today.tree.treeId}:${today.day.dayId}`} today={today} bloom={bloom} />;
}

function DailyTreeContent({ today, bloom }: { today: Today; bloom: boolean }) {
  const { session, selectTree } = useSession();
  const { timeOfDay, now, watering, consumeGivingFeedback } = useRitual();
  const { reducedMotion } = useStoryTime();
  const [opening, setOpening] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const started = performance.now();
    const timer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / 2400);
      setOpening(progress * progress * (3 - 2 * progress));
      if (progress === 1) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [reducedMotion]);
  const sceneTime = today.day.isDemo && today.myAnswer ? 1
    : Math.max(0.42 + 0.58 * timeOfDay, reducedMotion ? 0.56 : 0.42 + 0.14 * opening);
  const theme = themeAt(sceneTime);
  const submitAnswer = useMutation(api.answers.submit);
  const sendNote = useMutation(api.notes.send);
  const restartDemo = useMutation(api.demo.restart);
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
  const [wateringOpen, setWateringOpen] = useState(false);
  const [charityOpen, setCharityOpen] = useState(false);
  const unlocked = today.myAnswer !== null && today.day.bloomedAt !== undefined;
  const selected = unlocked ? today.answers.find((answer) => answer.blossom === selectedIndex) ?? null : null;
  const canAnswer = !today.myAnswer && today.day.bloomedAt === undefined && now >= today.day.opensAt && now < today.day.bloomAt;
  const notes = today.notes.map((item) => ({ from: item.fromBlossom, to: item.toBlossom, count: 1, own: item.fromMemberId === today.member.memberId }));
  const fruits = useMemo(() => today.fruits.map((fruit) => ({ id: fruit.fruitId, golden: false, mine: fruit.isMine })), [today.fruits]);
  const fruitStatus = getTreeDataStatus({ fruits });
  const detailUnavailable = fruitStatus.status === "unavailable";
  const [sampleFailed, setSampleFailed] = useState(false);
  const sampleStarted = useRef(false);
  const lastRead = useRef(-1);
  const [fireflies, setFireflies] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [preview, setPreview] = useState(0);
  const [answeredBeforeLaunch] = useState(() => launch.fresh && today.myAnswer !== null);
  useEffect(() => { launch.fresh = false; }, []);
  const deviceId = session?.deviceId;
  const treeId = today.tree.treeId;
  const needsSample = today.tree.isHost && !sampleFailed && (answeredBeforeLaunch
    || (!today.myAnswer && (!today.day.isDemo || today.day.bloomedAt !== undefined || now >= today.day.bloomAt)));
  useEffect(() => {
    if (!needsSample || !deviceId || sampleStarted.current) return;
    sampleStarted.current = true;
    restartDemo({ deviceId, treeId }).catch(() => setSampleFailed(true));
  }, [needsSample, deviceId, treeId, restartDemo]);

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

  function freshDay() {
    if (session) void run(() => restartDemo({ deviceId: session.deviceId, treeId: today.tree.treeId }), () => { setSettings(false); router.replace("/today"); });
  }

  function readNext() {
    const blossoms = today.answers.map((answer) => answer.blossom).sort((a, b) => a - b);
    if (!unlocked || !blossoms.length) return;
    lastRead.current = blossoms[(blossoms.indexOf(lastRead.current) + 1) % blossoms.length];
    choose(lastRead.current);
  }

  function choose(index: number) {
    if (!unlocked || !today.answers.some((answer) => answer.blossom === index)) return;
    setSelectedIndex(index);
    setNoteComposer(false);
    setNoteSent(false);
    setNote("");
    setError("");
  }

  if (needsSample) return <Scene timeOfDay={timeOfDay} meta="StoryTime · S.A.C.K." title="Opening today’s tree…" />;

  const detail = unlocked ? `${today.answerCount} ${today.answerCount === 1 ? "answer" : "answers"} · tap to read` : `${today.answerCount} of ${today.memberCount} answered${today.day.isDemo ? "" : ` · bloom ${bloomLabel(today.day.bloomAt)} local time`}`;
  return <StoryTimeProvider timeOfDay={sceneTime}><Scene timeOfDay={sceneTime} title={today.day.question}
    treeKey={`${today.tree.treeId}:${today.day.dayId}`}
    treeUnavailable={detailUnavailable}
    meta={`${bloom ? "Bloom" : "StoryTime"} · ${today.tree.name}`} detail={detail} onPressDetail={unlocked ? readNext : undefined}
    onOpenTree={() => { setError(""); setSettings(true); }}
    underQuestion={<View style={sceneStyles.stack}>
      <TodayCharitySummary charity={today.charity} totalRaisedCents={today.totalRaisedCents} isDemo={today.day.isDemo} onShowDetails={() => { setError(""); setCharityOpen(true); }} />
      <TodayStreaks compact summary={today.streaks} color={theme.text} />
      <FruitDetailStatus status={fruitStatus} fruitCount={fruits.length} />
    </View>}
    tree={{ answers: today.answerCount, mine: today.myAnswer ? [today.myAnswer.blossom] : [], notes, lanterns: 0, onTapBlossom: choose,
      fruits, lightBundles: Math.ceil(today.lightBundles / 2) + preview, goldenLightBundles: Math.ceil(today.goldenLightBundles / 2),
      lightEvent: watering.treeEvent && { ...watering.treeEvent, lightBundles: Math.ceil(watering.treeEvent.lightBundles / 2) } }}
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
    </AnswerCard>
    )}>
    <GivingFeedback baselineId={watering.baselineId} event={watering.feedbackEvent} onConsumed={consumeGivingFeedback} color={detailUnavailable ? theme.text : theme.lantern} />
    {canAnswer && <StoryButton label="Leave your answer" style={productSceneStyles.primary} onPress={() => { setError(""); setComposer(true); }} />}
    {today.myAnswer && !unlocked && <StoryText variant="caption" color={detailUnavailable ? theme.text : theme.paper}>Your answer is planted.</StoryText>}
    {!today.myAnswer && !canAnswer && <StoryText color={detailUnavailable ? theme.text : theme.paper}>{now < today.day.opensAt ? "The question opens soon." : "This day has closed. Come back for tomorrow’s question."}</StoryText>}
    {today.tree.isHost && !today.myAnswer && !canAnswer && <StoryButton label="Start a fresh day" tone="quiet" loading={busy} onPress={freshDay} />}
    {fireflies > 0 && <StoryButton label={`Share your ${fireflies} ${fireflies === 1 ? "firefly" : "fireflies"}`} tone="quiet" onPress={() => setShareOpen(true)} />}
    {today.myAnswer && <StoryButton label="Support S.A.C.K." style={productSceneStyles.primary} onPress={() => setWateringOpen(true)} />}
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
      {today.tree.isHost && <StoryButton label="Start a fresh day" tone="quiet" loading={busy} onPress={freshDay} />}
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
      <StoryButton label="Choose another tree" tone="quiet" loading={busy} onPress={() => {
        void run(() => selectTree(null), () => router.replace({ pathname: "/", params: { choose: "1" } }));
      }} />
    </Panel>}
    {wateringOpen && <WateringComposer today={today} onClose={() => setWateringOpen(false)}
      onPreview={setPreview} onPaid={(added) => { setWateringOpen(false); setFireflies((count) => count + added); }} />}
    {shareOpen && <Panel title="Your fireflies." onClose={() => setShareOpen(false)}>
      <StoryText color="#ffd27a" style={{ fontSize: 72, lineHeight: 80, textAlign: "center" }}>{fireflies}</StoryText>
      <StoryText color="#f6efe6" style={{ textAlign: "center" }}>{fireflies === 1 ? "firefly" : "fireflies"} on today’s tree are yours. Each one is a dollar for S.A.C.K.</StoryText>
      <StoryButton label="Share" onPress={() => {
        void Share.share({ message: `I lit ${fireflies} ${fireflies === 1 ? "firefly" : "fireflies"} on today’s StoryTime tree for S.A.C.K. https://suarezc-storytime.expo.app` }).catch(() => undefined);
      }} />
    </Panel>}
    {charityOpen && <Panel title="Today’s charity." onClose={() => setCharityOpen(false)}>
      <CharityDetails charity={today.charity} onOpenLink={(url) => {
        void WebBrowser.openBrowserAsync(url).catch(() => setError("The charity website couldn’t open. Please try again."));
      }} />
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
    </Panel>}
  </Scene></StoryTimeProvider>;
}
