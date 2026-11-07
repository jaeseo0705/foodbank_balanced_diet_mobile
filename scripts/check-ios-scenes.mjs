import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const appDirectory = readdirSync('ios').find((name) => {
  try { return readdirSync(join('ios', name)).includes('AppDelegate.swift'); } catch { return false; }
});
assert.ok(appDirectory, 'A generated iOS application directory must exist');
const delegate = readFileSync(join('ios', appDirectory, 'AppDelegate.swift'), 'utf8');
const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join('ios', appDirectory, 'Info.plist')], { encoding: 'utf8' }));
const manifest = plist.UIApplicationSceneManifest;
assert.ok(manifest, 'Xcode 27 requires a scene manifest');
assert.equal(manifest.UIApplicationSupportsMultipleScenes, false);
const scenes = manifest.UISceneConfigurations?.UIWindowSceneSessionRoleApplication;
assert.ok(scenes?.some((scene) => scene.UISceneDelegateClassName === 'EXExpoAppSceneDelegate'),
  'SDK 57 must use the backported Expo scene delegate');
assert.match(delegate, /ExpoReactNativeFactoryProvider/);
assert.doesNotMatch(delegate, /factory\.startReactNative\s*\(/, 'The scene delegate must start React Native');
assert.doesNotMatch(delegate, /window\s*=\s*UIWindow\(frame:/, 'The scene delegate must create the window');
console.log('Generated iOS scene lifecycle configuration passed.');
