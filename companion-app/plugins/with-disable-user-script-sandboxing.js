const { withXcodeProject } = require("expo/config-plugins");

/** CocoaPods resource scripts write into ios/Pods; Xcode 26 sandboxes that by default. */
module.exports = function withDisableUserScriptSandboxing(config) {
  return withXcodeProject(config, (config) => {
    const configurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configurations)) {
      const settings = configurations[key].buildSettings;
      if (settings) {
        settings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
      }
    }
    return config;
  });
};
