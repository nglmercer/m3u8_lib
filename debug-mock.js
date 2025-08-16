// Debug script to test the mock
const ffmpeg = require('./tests/__mocks__/fluent-ffmpeg.js');

console.log('Mock loaded:', typeof ffmpeg);
console.log('Mock default:', typeof ffmpeg.default);
console.log('ffprobe available:', typeof ffmpeg.ffprobe);

// Test creating an instance
const instance = ffmpeg('test-input.mp4');
console.log('Instance created:', typeof instance);
console.log('Instance has input method:', typeof instance.input);
console.log('Instance has output method:', typeof instance.output);
console.log('Instance has run method:', typeof instance.run);

// Test chaining
try {
  const chained = ffmpeg('test-input.mp4').input('test-audio.mp3');
  console.log('Chaining works:', typeof chained);
  console.log('Chained has output method:', typeof chained.output);
} catch (error) {
  console.error('Chaining failed:', error.message);
}