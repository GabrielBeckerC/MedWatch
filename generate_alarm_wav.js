import fs from 'fs';
import path from 'path';

function createWavHeader(dataLength, sampleRate = 44100, numChannels = 1, bitsPerSample = 16) {
  const buffer = Buffer.alloc(44);
  
  // RIFF identifier
  buffer.write('RIFF', 0);
  // file length minus 8
  buffer.writeUInt32LE(36 + dataLength, 4);
  // RIFF type
  buffer.write('WAVE', 8);
  // format chunk identifier
  buffer.write('fmt ', 12);
  // format chunk length
  buffer.writeUInt32LE(16, 16);
  // sample format (1 = PCM)
  buffer.writeUInt16LE(1, 20);
  // channel count
  buffer.writeUInt16LE(numChannels, 22);
  // sample rate
  buffer.writeUInt32LE(sampleRate, 24);
  // byte rate (sampleRate * numChannels * bitsPerSample / 8)
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  // block align (numChannels * bitsPerSample / 8)
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  // bits per sample
  buffer.writeUInt16LE(bitsPerSample, 34);
  // data chunk identifier
  buffer.write('data', 36);
  // data length
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

function generateAlarmWav() {
  const sampleRate = 44100;
  const durationSeconds = 3.5;
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const dataBuffer = Buffer.alloc(totalSamples * 2); // 16-bit PCM (2 bytes per sample)

  // Loud energetic melody notes: C5 (523.25), E5 (659.25), G5 (783.99), C6 (1046.50)
  const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  const pulseDuration = 0.25; // seconds per note

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.floor(t / pulseDuration) % notes.length;
    const freq = notes[noteIdx];
    const subNoteIdx = (noteIdx + 2) % notes.length;
    const freq2 = notes[subNoteIdx];

    // Envelope ramp per note pulse (attack & decay)
    const tInPulse = t % pulseDuration;
    let envelope = 1.0;
    if (tInPulse < 0.03) {
      envelope = tInPulse / 0.03;
    } else if (tInPulse > pulseDuration - 0.05) {
      envelope = (pulseDuration - tInPulse) / 0.05;
    }

    // Synthesize fundamental + octave harmonic for high clarity sound
    const wave1 = Math.sin(2 * Math.PI * freq * t);
    const wave2 = 0.5 * Math.sin(2 * Math.PI * freq2 * t);
    const wave3 = 0.3 * (Math.sin(2 * Math.PI * freq * 2 * t)); // 2nd harmonic

    const combined = (wave1 + wave2 + wave3) * 0.7 * envelope;
    
    // Clamp to 16-bit signed integer [-32768, 32767]
    const sample = Math.max(-1, Math.min(1, combined));
    const intSample = Math.floor(sample < 0 ? sample * 32768 : sample * 32767);

    dataBuffer.writeInt16LE(intSample, i * 2);
  }

  const headerBuffer = createWavHeader(dataBuffer.length, sampleRate);
  const finalBuffer = Buffer.concat([headerBuffer, dataBuffer]);

  // Ensure directories exist
  const resRawDir = path.resolve('android/app/src/main/res/raw');
  const publicDir = path.resolve('public');

  if (!fs.existsSync(resRawDir)) {
    fs.mkdirSync(resRawDir, { recursive: true });
  }
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const rawPath = path.join(resRawDir, 'alarm_sound.wav');
  const publicPath = path.join(publicDir, 'alarm_sound.wav');

  fs.writeFileSync(rawPath, finalBuffer);
  fs.writeFileSync(publicPath, finalBuffer);

  console.log(`Successfully generated alarm WAV files (${finalBuffer.length} bytes):`);
  console.log(` - ${rawPath}`);
  console.log(` - ${publicPath}`);
}

generateAlarmWav();
