// Forces every CocoaPods target (including resource bundle targets such as
// "GoogleSignIn-GoogleSignIn" or "RNCAsyncStorage_resources") to a minimum
// iOS deployment target. New Xcode versions refuse to build any target below
// iOS 15.0, and React Native's own post_install fix skips resource bundles.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# [withPodsDeploymentTarget]';

function buildSnippet(minTarget) {
  return `
    ${MARKER} raise every pod target to at least iOS ${minTarget}
    min_ios_target = '${minTarget}'
    projects = [installer.pods_project] + (installer.respond_to?(:generated_projects) ? installer.generated_projects : [])
    projects.compact.uniq.each do |project|
      project.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new(min_ios_target)
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios_target
        end
      end
      project.targets.each do |target|
        target.build_configurations.each do |build_config|
          current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
          if current && Gem::Version.new(current) < Gem::Version.new(min_ios_target)
            build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios_target
          end
        end
      end
    end
`;
}

function addSnippet(podfile, minTarget) {
  if (podfile.includes(MARKER)) return podfile;
  const hook = /post_install do \|installer\|\n/;
  if (!hook.test(podfile)) {
    throw new Error('[withPodsDeploymentTarget] Could not find post_install block in Podfile');
  }
  return podfile.replace(hook, (m) => m + buildSnippet(minTarget));
}

const withPodsDeploymentTarget = (config, { deploymentTarget = '15.1' } = {}) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const podfile = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, addSnippet(podfile, deploymentTarget));
      return cfg;
    },
  ]);

module.exports = withPodsDeploymentTarget;
module.exports.addSnippet = addSnippet;
