import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const result = JSON.parse(execFileSync('npx', ['expo-modules-autolinking', 'resolve', '--platform', 'apple', '--json'], { encoding: 'utf8' }));
const module = result.modules.find((item) => item.packageName === 'foodbank-vision-ocr');
assert.ok(module, 'The local Vision module must be included in Apple autolinking');
console.log(JSON.stringify(module, null, 2));
assert.ok(JSON.stringify(module.modules).includes('"FoodbankVisionOCRModule"'), 'The Swift module must be registered');
assert.ok(module.pods.some((pod) => pod.podName === 'FoodbankVisionOCR'), 'The OCR podspec must resolve');
console.log('Local Apple Vision module autolinking passed.');
