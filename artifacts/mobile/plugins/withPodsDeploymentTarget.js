const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

const MARKER = "# Shot Doctor: minimum deployment target for all Pods, including resource bundles";

module.exports = function withPodsDeploymentTarget(expoConfig, { deploymentTarget = "15.1" } = {}) {
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(deploymentTarget)) {
    throw new Error("withPodsDeploymentTarget: deploymentTarget must be a numeric iOS version.");
  }
  return withDangerousMod(expoConfig, ["ios", async mod => {
    const podfilePath = path.join(mod.modRequest.platformProjectRoot, "Podfile");
    const podfile = await fs.readFile(podfilePath, "utf8");
    const postInstall = /^([ \t]*)post_install do \|installer\|[ \t]*\r?$/m.exec(podfile);
    if (!postInstall) {
      throw new Error("withPodsDeploymentTarget: could not find `post_install do |installer|` in ios/Podfile.");
    }
    if (podfile.includes(MARKER)) return mod;

    const indent = `${postInstall[1]}  `;
    const ruby = [
      MARKER,
      "deployment_projects = [installer.pods_project]",
      "deployment_projects.concat(Array(installer.generated_projects)) if installer.respond_to?(:generated_projects)",
      "deployment_projects.compact.uniq.each do |project|",
      "  build_configurations = project.build_configurations + project.targets.flat_map(&:build_configurations)",
      "  build_configurations.each do |build_config|",
      "    current_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '0'",
      `    if Gem::Version.new(current_target) < Gem::Version.new('${deploymentTarget}')`,
      `      build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'`,
      "    end",
      "  end",
      "end",
    ].map(line => indent + line).join("\n");
    await fs.writeFile(podfilePath, podfile.replace(postInstall[0], `${postInstall[0]}\n${ruby}`));
    return mod;
  }]);
};
