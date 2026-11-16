const fs = require("node:fs");
const path = require("node:path");
const { IOSConfig, withXcodeProject } = require("expo/config-plugins");
const plist = require("@expo/plist").default;

module.exports = function withStoryTimeWidgets(config, options = {}) {
  if (options.enabled !== true) return config;
  if (!config.ios?.bundleIdentifier || !options.bundleIdentifier || !options.groupIdentifier ||
    !options.groupIdentifier.startsWith("group.")) {
    throw new Error("StoryTime widgets require release-owner-approved app, extension and App Group identifiers");
  }
  const withWidgets = require("expo-widgets/app.plugin.js").default;
  const widgetOptions = {
    bundleIdentifier: options.bundleIdentifier,
    groupIdentifier: options.groupIdentifier,
    enablePushNotifications: false,
    frequentUpdates: false,
    enableAndroid: false,
    widgets: [{
      name: "StoryTimeGiving",
      displayName: "Your daily peach",
      description: "Grow your peach by answering one question every day.",
      ios: {
        supportedFamilies: ["systemSmall", "systemMedium", "accessoryCircular"],
        contentMarginsDisabled: true,
        initialLayout: "src/widgets/entry.ts",
      },
      android: null,
    }],
  };
  config.extra = { ...config.extra, storytimeWidgetsEnabled: true };
  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const target = Object.entries(project.pbxNativeTargetSection()).find(([, value]) =>
      typeof value === "object" && value.name?.replaceAll('"', "") === "ExpoWidgetsTarget");
    if (!target) throw new Error("StoryTime widget target was not generated");
    const [targetUuid, nativeTarget] = target;
    const platformRoot = mod.modRequest.platformProjectRoot;
    const directory = path.join(platformRoot, "ExpoWidgetsTarget");
    const fontNames = ["Bricolage.ttf", "Inter.ttf"];
    const catalog = path.join(directory, "StoryTimeWidgetArt.xcassets");
    const peach = path.join(catalog, "StoryTimePeach.imageset");
    fs.mkdirSync(peach, { recursive: true });
    fs.writeFileSync(path.join(catalog, "Contents.json"), JSON.stringify({ info: { version: 1, author: "xcode" } }));
    fs.copyFileSync(path.join(mod.modRequest.projectRoot, "assets/widgets/healthy-1.png"), path.join(peach, "peach.png"));
    fs.writeFileSync(path.join(peach, "Contents.json"), JSON.stringify({
      images: [{ filename: "peach.png", idiom: "universal" }],
      info: { version: 1, author: "xcode" },
      properties: { "template-rendering-intent": "original" },
    }));
    const resources = project.hash.project.objects.PBXResourcesBuildPhase ?? {};
    if (!nativeTarget.buildPhases.some((phase) => resources[phase.value])) {
      project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", targetUuid);
    }
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, "StoryTimeWidgetFonts");
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: path.join("ExpoWidgetsTarget", "StoryTimeWidgetArt.xcassets"),
      groupName: "StoryTimeWidgetFonts",
      project,
      targetUuid,
      isBuildFile: true,
    });
    for (const name of fontNames) {
      fs.copyFileSync(path.join(mod.modRequest.projectRoot, "assets/widgets/fonts", name), path.join(directory, name));
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.join("ExpoWidgetsTarget", name),
        groupName: "StoryTimeWidgetFonts",
        project,
        targetUuid,
        isBuildFile: true,
      });
    }
    const infoPath = path.join(directory, "Info.plist");
    const info = plist.parse(fs.readFileSync(infoPath, "utf8"));
    info.UIAppFonts = [...new Set([...(info.UIAppFonts ?? []), ...fontNames])];
    fs.writeFileSync(infoPath, plist.build(info));
    return mod;
  });
  return withWidgets(config, widgetOptions);
};
