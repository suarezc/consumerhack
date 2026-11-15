const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");
const plist = require("@expo/plist").default;

const root = path.resolve(__dirname, "..");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "storytime-widgets-"));
const originalConfig = fs.readFileSync(path.join(root, "app.json"));
const base = JSON.parse(originalConfig).expo;
const approvedPlan = process.argv.includes("--approved-plan");
const identifiers = approvedPlan ? {
  app: "com.charlessuarez.storytime", extension: "com.charlessuarez.storytime.widgets",
  group: "group.com.charlessuarez.storytime.widgets", team: "432CDA2QK3",
} : {
  app: "example.storytime.localvalidation", extension: "example.storytime.localvalidation.widgets",
  group: "group.example.storytime.localvalidation", team: undefined,
};
const excluded = new Set(["node_modules", ".git", ".expo", "ios", "android", "dist"]);
function run(args, cwd = scratch) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit", env: { ...process.env, CI: "1" } });
  assert.equal(result.status, 0, `${args[0]} failed`);
}
function config(enabled) {
  fs.writeFileSync(path.join(scratch, "app.json"), JSON.stringify({ expo: {
    ...base,
    ios: { ...base.ios, bundleIdentifier: identifiers.app, ...(identifiers.team ? { appleTeamId: identifiers.team } : {}) },
    plugins: [...base.plugins, ["./plugins/withStoryTimeWidgets.cjs", {
      enabled,
      bundleIdentifier: identifiers.extension,
      groupIdentifier: identifiers.group,
    }]],
  } }, null, 2));
}
try {
  fs.cpSync(root, scratch, { recursive: true, filter: (file) => {
    const relative = path.relative(root, file);
    const first = relative.split(path.sep)[0];
    return !excluded.has(first) && !first.startsWith(".env");
  } });
  fs.symlinkSync(path.join(root, "node_modules"), path.join(scratch, "node_modules"), "dir");
  const cli = require.resolve("expo/bin/cli");
  config(false);
  run([cli, "prebuild", "--platform", "ios", "--no-install"]);
  assert.equal(fs.existsSync(path.join(scratch, "ios/ExpoWidgetsTarget")), false);
  const disabledProject = fs.readFileSync(path.join(scratch, "ios/storytime.xcodeproj/project.pbxproj"), "utf8");
  assert.ok(!disabledProject.includes("ExpoWidgetsTarget"));
  config(true);
  run([cli, "prebuild", "--platform", "ios", "--no-install"]);
  const target = path.join(scratch, "ios/ExpoWidgetsTarget");
  const info = plist.parse(fs.readFileSync(path.join(target, "Info.plist"), "utf8"));
  assert.deepEqual(info.UIAppFonts, ["Bricolage.ttf", "Inter.ttf"]);
  assert.equal(info.ExpoWidgetsAppGroupIdentifier, identifiers.group);
  const mainInfo = plist.parse(fs.readFileSync(path.join(scratch, "ios/storytime/Info.plist"), "utf8"));
  assert.ok(!mainInfo.UIAppFonts?.includes("Bricolage.ttf"));
  assert.ok(!mainInfo.UIAppFonts?.includes("Inter.ttf"));
  const swift = fs.readFileSync(path.join(target, "StoryTimeGiving.swift"), "utf8");
  for (const family of [".systemSmall", ".systemMedium", ".accessoryCircular"]) assert.ok(swift.includes(family));
  const project = fs.readFileSync(path.join(scratch, "ios/storytime.xcodeproj/project.pbxproj"), "utf8");
  for (const name of ["Bricolage.ttf", "Inter.ttf"]) {
    assert.ok(fs.statSync(path.join(target, name)).size > 0);
    assert.ok(project.includes(`${name} in Resources`));
  }
  const parsedProject = require("xcode").project(path.join(scratch, "ios/storytime.xcodeproj/project.pbxproj"));
  parsedProject.parseSync();
  const objects = parsedProject.hash.project.objects;
  const extension = Object.values(objects.PBXNativeTarget).find((value) => typeof value === "object" && value.name === "ExpoWidgetsTarget");
  const resourcePhase = extension.buildPhases.map((phase) => objects.PBXResourcesBuildPhase?.[phase.value]).find(Boolean);
  for (const file of resourcePhase.files) {
    const buildFile = objects.PBXBuildFile[file.value];
    assert.ok(buildFile, "resource phase must point to a PBXBuildFile");
    const resource = objects.PBXFileReference[buildFile.fileRef];
    assert.ok(resource, "resource must have a file reference");
    assert.ok(fs.existsSync(path.join(scratch, "ios", resource.path.replaceAll('"', ""))));
  }
  const entitlements = plist.parse(fs.readFileSync(path.join(target, "ExpoWidgetsTarget.entitlements"), "utf8"));
  assert.deepEqual(entitlements["com.apple.security.application-groups"], [identifiers.group]);
  assert.ok(!entitlements["aps-environment"]);
  const rootEntitlements = plist.parse(fs.readFileSync(path.join(scratch, "ios/storytime/storytime.entitlements"), "utf8"));
  assert.deepEqual(rootEntitlements["com.apple.security.application-groups"], [identifiers.group]);
  const resolved = require("@expo/config").getConfig(scratch).exp;
  const easTarget = resolved.extra.eas.build.experimental.ios.appExtensions.find((item) => item.targetName === "ExpoWidgetsTarget");
  assert.deepEqual(easTarget, { targetName: "ExpoWidgetsTarget", bundleIdentifier: identifiers.extension,
    entitlements: { "com.apple.security.application-groups": [identifiers.group] } });
  if (approvedPlan) console.log(JSON.stringify({ localGenerationOnly: true, rootBundleIdentifier: identifiers.app,
    appleTeamId: identifiers.team, rootEntitlements, extensionEntitlements: entitlements, easTarget }, null, 2));
  const registry = path.join(scratch, "registry.json");
  run([require.resolve("expo-widgets/package.json").replace("package.json", "scripts/build-layout-registry.mjs"), scratch, "ios", registry,
    path.join(target, "ExpoWidgetsLayoutRegistry.config.json")]);
  const registered = JSON.parse(fs.readFileSync(registry, "utf8")).widgets.StoryTimeGiving;
  assert.ok(registered.layout.includes("containerBackground"));
  assert.equal(registered.initialProps.count, null);
  assert.equal(registered.initialProps.url, "storytime://");
  const runtime = path.join(scratch, "runtime.js");
  run([require.resolve("expo-widgets/package.json").replace("package.json", "scripts/build-bundle.mjs"), scratch, "ios", runtime]);
  const context = vm.createContext({ console, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(runtime, "utf8"), context);
  context.__expoWidgetLayout = vm.runInContext(`(${registered.layout})`, context);
  let layouts = 0;
  for (const state of ["new", "current", "at_risk", "ended", "unavailable"]) {
    for (const family of ["systemSmall", "systemMedium", "accessoryCircular"]) {
      for (const colorScheme of ["light", "dark"]) {
        for (const reduced of [false, true]) {
          for (const tier of [1, 3, 7, 30]) {
            for (const fade of [0, 1, 2]) {
              const props = { ...registered.initialProps, state, count: state === "unavailable" ? null : 6,
                tier, fade, message: "Fixture query facts", totalLabel: "$2.50", answersLabel: "40 answered" };
              const node = context.__expoWidgetRender(props, {
            widgetFamily: family, colorScheme, isLuminanceReduced: reduced,
            widgetRenderingMode: family === "accessoryCircular" ? "vibrant" : "fullColor",
              });
              assert.ok(node && typeof node === "object");
              const serialized = JSON.stringify(node);
              assert.ok(serialized.includes("storytime://"));
              assert.ok(serialized.includes("containerBackground"));
              assert.ok(!serialized.includes("RedBoxView"));
              assert.ok(!serialized.includes("uiImage"));
              assert.ok(!/peach|withered|thirsty|blossom/.test(serialized));
              if (family === "systemMedium") assert.ok(serialized.includes("S.A.C.K."));
              if (family === "accessoryCircular") {
                assert.ok((serialized.match(/giving-spark-/g) ?? []).length <= 2);
                assert.ok(!serialized.includes("giving-halo"));
                assert.ok(!/Gradient|ProgressView|Gauge/.test(serialized));
              }
              layouts += 1;
            }
          }
        }
      }
    }
  }
  const expired = JSON.stringify(context.__expoWidgetRender({ ...registered.initialProps,
    state: "current", count: 7, expiresAt: 1, totalLabel: "$123.45" },
  { widgetFamily: "systemMedium", colorScheme: "light" }));
  assert.ok(expired.includes("Open StoryTime to refresh"));
  assert.ok(!expired.includes("$123.45"));
  const oldPresentation = JSON.stringify(context.__expoWidgetRender({ ...registered.initialProps,
    presentationVersion: 1, state: "healthy", count: 7, totalLabel: "$123.45", fruitImage: "file:///old.png" },
  { widgetFamily: "systemMedium", colorScheme: "light" }));
  assert.ok(oldPresentation.includes("Open StoryTime to refresh"));
  assert.ok(!oldPresentation.includes("$123.45"));
  assert.ok(!oldPresentation.includes("file:///old.png"));
  assert.equal(fs.readFileSync(path.join(root, "app.json"), "utf8"), originalConfig.toString());
  console.log(`Widget disabled/enabled prebuild, extension resources and ${layouts} layouts evaluated in the published isolated JS runtime. This checks native view descriptions, not native rendering. No native compilation or signing performed.`);
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
