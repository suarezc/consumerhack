import { Redirect } from "expo-router";
import { useState } from "react";
import { Button, Text, TextInput } from "react-native";

import { Screen, SessionGate } from "@/components/screens/Screen";
import { useSession } from "@/providers/SessionProvider";

export default function Entry() {
  return <SessionGate><JoinTree /></SessionGate>;
}

function JoinTree() {
  const { session } = useSession();
  const [mode, setMode] = useState<"join" | "create">("join");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [treeName, setTreeName] = useState("");

  if (session?.treeId) return <Redirect href="/today" />;

  return <Screen title="A little room to grow">
    <Text>One question a day. A small circle of people. A tree you grow together.</Text>
    <Button title={mode === "join" ? "Create a tree instead" : "Join a tree instead"} onPress={() => setMode(mode === "join" ? "create" : "join")} />
    <TextInput accessibilityLabel="Your name" placeholder="Your name" value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
    {mode === "join" ? <TextInput accessibilityLabel="Tree invite code" placeholder="Six-character invite code" value={code} onChangeText={(value) => setCode(value.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={6} /> : <TextInput accessibilityLabel="Tree name" placeholder="Tree name" value={treeName} onChangeText={setTreeName} maxLength={80} />}
    <Text accessibilityRole="alert">Connecting the garden. Joining and creating trees will be available when the service is ready.</Text>
    <Button title={mode === "join" ? "Join tree" : "Plant a tree"} disabled />
    <Text>Your anonymous identity stays on this device. No account needed.</Text>
  </Screen>;
}
