import { useMutation, useQuery } from "convex/react";
import { Redirect } from "expo-router";
import { useRef, useState } from "react";

import { Panel, Scene } from "@/components/screens/Scene";
import { SessionGate } from "@/components/screens/Screen";
import { StoryButton, StoryField, StoryText } from "@/design";
import { useRitual } from "@/providers/RitualProvider";
import { useSession } from "@/providers/SessionProvider";
import { api } from "@/services/api";
import { mutationError } from "@/services/errors";

export default function Entry() {
  return <SessionGate><JoinTree /></SessionGate>;
}

function JoinTree() {
  const { session, selectTree } = useSession();
  const { timeOfDay } = useRitual();
  const trees = useQuery(api.trees.list, session ? { deviceId: session.deviceId } : "skip");
  const create = useMutation(api.trees.create);
  const join = useMutation(api.trees.join);
  const [mode, setMode] = useState<"join" | "create" | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [treeName, setTreeName] = useState("");
  const [cause, setCause] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");

  if (session?.treeId) return <Redirect href="/today" />;

  async function submit() {
    if (!session || !mode || submitting.current) return;
    if (!name.trim() || (mode === "join" ? code.trim().length !== 6 : !treeName.trim())) {
      setError("Add your name and " + (mode === "join" ? "a six-character invite code." : "a name for your tree."));
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = mode === "join"
        ? await join({ deviceId: session.deviceId, code: code.trim(), memberName: name.trim() })
        : await create({ deviceId: session.deviceId, name: treeName.trim(), memberName: name.trim(), ...(cause.trim() ? { cause: { name: cause.trim() } } : {}) });
      try {
        await selectTree(result.treeId);
      } catch {
        setError("Your membership was saved, but this device couldn’t remember the tree. Close this form and select it below to try again.");
      }
    } catch (failure) {
      setError(mutationError(failure, "We couldn’t reach the garden. Check your connection and try again."));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <Scene timeOfDay={timeOfDay} meta="StoryTime · a daily ritual"
    title="What grows when we make a little room for each other?" detail="One question a day. One blossom for every answer.">
    <StoryButton label="Join your circle" onPress={() => { setError(""); setMode("join"); }} />
    <StoryButton label="Plant a tree" tone="quiet" onPress={() => { setError(""); setMode("create"); }} />
    {trees?.map((tree) => <StoryButton key={tree.treeId} label={`Return to ${tree.name}`} tone="quiet" disabled={busy} onPress={() => {
      setBusy(true);
      void selectTree(tree.treeId).catch(() => setError("This device couldn’t remember the tree. Please try again.")).finally(() => setBusy(false));
    }} />)}
    {!!error && !mode && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
    <StoryText variant="caption" color="#c6c1c2">No account. Your place in the circle stays on this device.</StoryText>
    {mode && <Panel title={mode === "join" ? "Find your circle." : "A small beginning."} onClose={() => { if (!busy) setMode(null); }}>
      <StoryField label="Your name" value={name} onChangeText={setName} maxLength={60} autoComplete="name" editable={!busy} />
      {mode === "join"
        ? <StoryField label="Six-character invite code" value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={6} editable={!busy} />
        : <><StoryField label="Tree name" value={treeName} onChangeText={setTreeName} maxLength={80} editable={!busy} />
          <StoryField label="A cause to support (optional)" value={cause} onChangeText={setCause} maxLength={120} editable={!busy} /></>}
      {!!error && <StoryText color="#ffd27a" accessibilityRole="alert">{error}</StoryText>}
      <StoryButton label={mode === "join" ? "Join tree" : "Plant tree"} loading={busy} onPress={() => { void submit(); }} />
    </Panel>}
  </Scene>;
}
