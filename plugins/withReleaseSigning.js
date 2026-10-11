const { withAppBuildGradle } = require('expo/config-plugins');

const STORE_FILE_PROP = 'WEREWOLVES_UPLOAD_STORE_FILE';

const RELEASE_SIGNING_CONFIG = `
        release {
            if (project.hasProperty('${STORE_FILE_PROP}')) {
                storeFile file(${STORE_FILE_PROP})
                storePassword WEREWOLVES_UPLOAD_STORE_PASSWORD
                keyAlias WEREWOLVES_UPLOAD_KEY_ALIAS
                keyPassword WEREWOLVES_UPLOAD_KEY_PASSWORD
            }
        }`;

const RELEASE_SIGNING_SELECTION =
  `signingConfig project.hasProperty('${STORE_FILE_PROP}') ? signingConfigs.release : signingConfigs.debug`;

function addReleaseSigning(gradle) {
  if (gradle.includes(STORE_FILE_PROP)) return gradle;

  const debugConfig = /(signingConfigs \{\s*debug \{[^}]*\})/;
  const releaseBuildType = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!debugConfig.test(gradle) || !releaseBuildType.test(gradle)) {
    throw new Error('withReleaseSigning: android/app/build.gradle layout changed; update the plugin.');
  }

  return gradle
    .replace(debugConfig, `$1${RELEASE_SIGNING_CONFIG}`)
    .replace(releaseBuildType, `$1${RELEASE_SIGNING_SELECTION}`);
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};
