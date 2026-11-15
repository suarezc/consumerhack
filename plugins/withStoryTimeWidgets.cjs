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
      displayName: "Your giving ritual",
      description: "A peach for your giving streak and today's sandbox tree.",
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
    const resources = project.hash.project.objects.PBXResourcesBuildPhase ?? {};
    if (!nativeTarget.buildPhases.some((phase) => resources[phase.value])) {
      project.addBuildPhase([], "PBXResourcesBuildPhase", "Resources", targetUuid);
    }
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, "StoryTimeWidgetFonts");
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
