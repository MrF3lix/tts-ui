// Converts audio into a 16-bit mono WAV file, which the gateway can always read.
// Uncompressed WAVs are read directly: browsers can't decode some of them (Chrome fails on
// 64-bit float, which e.g. scipy.io.wavfile writes from float64 arrays), and reading them keeps
// the original sample rate. Everything else (MP3, M4A, FLAC, WebM/Opus from the microphone, ...)
// goes through the browser's decoder.

export type WavFile = { file: File; duration: number }

type Audio = { samples: Float32Array; sampleRate: number }

/** `name` is the new file's name without extension. */
export async function toWav(blob: Blob, name: string): Promise<WavFile> {
  const data = await blob.arrayBuffer()
  const audio = readWav(data) ?? await decode(data)
  const file = new File([encodeWav(audio.samples, audio.sampleRate)], `${name}.wav`, { type: "audio/wav" })
  return { file, duration: audio.samples.length / audio.sampleRate }
}

async function decode(data: ArrayBuffer): Promise<Audio> {
  const context = new AudioContext()
  let buffer: AudioBuffer
  try {
    buffer = await context.decodeAudioData(data)
  } finally {
    void context.close()
  }
  const samples = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const channel = buffer.getChannelData(c)
    for (let i = 0; i < buffer.length; i++) {
      samples[i] += channel[i] / buffer.numberOfChannels
    }
  }
  return { samples, sampleRate: buffer.sampleRate }
}

/** Integer or float PCM from a WAV (or RF64) file, mixed to mono; null for anything else. */
function readWav(buffer: ArrayBuffer): Audio | null {
  const view = new DataView(buffer)
  const tag = (offset: number) => String.fromCharCode(...new Uint8Array(buffer, offset, 4))
  if (buffer.byteLength < 12 || !["RIFF", "RF64"].includes(tag(0)) || tag(8) !== "WAVE") {
    return null
  }

  let format = 0, channels = 0, sampleRate = 0, bits = 0, dataOffset = -1, dataSize = 0
  for (let offset = 12; offset + 8 <= buffer.byteLength;) {
    const id = tag(offset)
    const size = view.getUint32(offset + 4, true)
    if (id === "fmt " && size >= 16) {
      format = view.getUint16(offset + 8, true)
      channels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bits = view.getUint16(offset + 22, true)
      // WAVE_FORMAT_EXTENSIBLE: the actual format is in the first bytes of the sub-format GUID
      if (format === 0xfffe && size >= 40) {
        format = view.getUint16(offset + 32, true)
      }
    } else if (id === "data") {
      dataOffset = offset + 8
      // RF64 and some recorders write 0xFFFFFFFF or a wrong size here: take the rest of the file
      dataSize = Math.min(size, buffer.byteLength - dataOffset)
      break
    }
    offset += 8 + size + (size % 2) // chunks are padded to an even size
  }

  const read = sampleReader(view, format, bits)
  if (dataOffset < 0 || !channels || !sampleRate || !read) {
    return null
  }
  const frameSize = (bits / 8) * channels
  const frames = Math.floor(dataSize / frameSize)
  const samples = new Float32Array(frames)
  for (let f = 0; f < frames; f++) {
    for (let c = 0; c < channels; c++) {
      samples[f] += read(dataOffset + f * frameSize + c * (bits / 8)) / channels
    }
  }
  return { samples, sampleRate }
}

// compressed formats (ADPCM, A-law, ...) return null and are left to the browser
function sampleReader(view: DataView, format: number, bits: number): ((offset: number) => number) | null {
  if (format === 1) { // integer PCM
    if (bits === 8) return (o) => (view.getUint8(o) - 128) / 128
    if (bits === 16) return (o) => view.getInt16(o, true) / 0x8000
    if (bits === 24) return (o) => (view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getInt8(o + 2) << 16)) / 0x800000
    if (bits === 32) return (o) => view.getInt32(o, true) / 0x80000000
  }
  if (format === 3) { // IEEE float
    if (bits === 32) return (o) => view.getFloat32(o, true)
    if (bits === 64) return (o) => view.getFloat64(o, true)
  }
  return null
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const dataSize = samples.length * 2
  const view = new DataView(new ArrayBuffer(44 + dataSize))
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  text(8, "WAVE")
  text(12, "fmt ")
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  text(36, "data")
  view.setUint32(40, dataSize, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return view.buffer
}
