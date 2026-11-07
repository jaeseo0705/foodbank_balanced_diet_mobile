import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const result = JSON.parse(execFileSync('npx', ['expo-modules-autolinking', 'resolve', '--platform', 'apple'], { encoding: 'utf8' }));
const module = result.modules.find((item) => item.packageName === 'foodbank-vision-ocr');
assert.ok(module, 'The local Vision module must be included in Apple autolinking');
assert.ok(module.modules.includes('FoodbankVisionOCRModule'), 'The Swift module must be registered');
assert.ok(module.pods.some((pod) => pod.podName === 'FoodbankVisionOCR'), 'The OCR podspec must resolve');
console.log('Local Apple Vision module autolinking passed.');
