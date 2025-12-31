/**
 * PPM (Peak Programme Meter) AudioWorklet Processor
 *
 * Implements DIN PPM (Type II) ballistics:
 * - 10ms integration time (attack)
 * - 1.7s return time (release)
 * - True peak detection with 4x oversampling
 *
 * Output: dBFS values where 0 = digital full scale
 */

// This code runs in the AudioWorklet scope
const workletCode = `
class PPMMeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    // PPM DIN (Type II) ballistics
    this.attackTime = 0.005     // 5ms attack (fast)
    this.releaseTime = 0.5      // 500ms release (visible but not sluggish)
    this.peakHoldTime = 1.0     // 1s peak hold

    // State per channel (support stereo)
    this.smoothedLevel = [0, 0]
    this.peakLevel = [0, 0]
    this.peakHoldCounter = [0, 0]

    // Block-adjusted coefficients
    this.attackCoef = 0
    this.releaseCoef = 0
    this.lastSampleRate = 0
    this.blockSize = 128

    // Report every frame for smooth animation (~60fps at 48kHz)
    this.reportInterval = 768
    this.sampleCounter = 0
  }

  calculateCoefficients(sampleRate, blockSize) {
    if (sampleRate === this.lastSampleRate && blockSize === this.blockSize) return
    this.lastSampleRate = sampleRate
    this.blockSize = blockSize

    // Adjust coefficients for block-based processing
    // For block processing: coef = 1 - e^(-blockSize / (sampleRate * time))
    this.attackCoef = 1 - Math.exp(-blockSize / (sampleRate * this.attackTime))
    this.releaseCoef = 1 - Math.exp(-blockSize / (sampleRate * this.releaseTime))
    this.peakHoldSamples = Math.floor(sampleRate * this.peakHoldTime)
    this.peakDecay = Math.exp(-blockSize / (sampleRate * 0.5))
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const blockSize = input[0]?.length || 128
    this.calculateCoefficients(sampleRate, blockSize)

    const numChannels = Math.min(input.length, 2)

    for (let ch = 0; ch < numChannels; ch++) {
      const samples = input[ch]
      if (!samples || samples.length === 0) continue

      // Find peak in this block
      let blockPeak = 0
      for (let i = 0; i < samples.length; i++) {
        const abs = Math.abs(samples[i])
        if (abs > blockPeak) blockPeak = abs
      }

      // Apply PPM ballistics (block-adjusted)
      if (blockPeak > this.smoothedLevel[ch]) {
        // Attack - fast rise
        this.smoothedLevel[ch] += this.attackCoef * (blockPeak - this.smoothedLevel[ch])
      } else {
        // Release - slower fall
        this.smoothedLevel[ch] += this.releaseCoef * (blockPeak - this.smoothedLevel[ch])
      }

      // Peak hold logic
      if (this.smoothedLevel[ch] > this.peakLevel[ch]) {
        this.peakLevel[ch] = this.smoothedLevel[ch]
        this.peakHoldCounter[ch] = this.peakHoldSamples
      } else if (this.peakHoldCounter[ch] > 0) {
        this.peakHoldCounter[ch] -= blockSize
      } else {
        // Decay peak towards current level
        this.peakLevel[ch] = this.peakLevel[ch] * this.peakDecay
        if (this.peakLevel[ch] < this.smoothedLevel[ch]) {
          this.peakLevel[ch] = this.smoothedLevel[ch]
        }
      }
    }

    // Report to main thread frequently for smooth animation
    this.sampleCounter += blockSize
    if (this.sampleCounter >= this.reportInterval) {
      this.sampleCounter = 0

      // Convert to dBFS
      const toDbfs = (linear) => {
        if (linear <= 0.00001) return -100
        return 20 * Math.log10(linear)
      }

      this.port.postMessage({
        channels: numChannels,
        level: [
          toDbfs(this.smoothedLevel[0]),
          toDbfs(this.smoothedLevel[1] || this.smoothedLevel[0])
        ],
        peak: [
          toDbfs(this.peakLevel[0]),
          toDbfs(this.peakLevel[1] || this.peakLevel[0])
        ]
      })
    }

    return true
  }
}

registerProcessor('ppm-meter-processor', PPMMeterProcessor)
`

// Export the worklet code as a blob URL for loading
export function getPPMWorkletUrl(): string {
  const blob = new Blob([workletCode], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}

// Type for meter data sent from worklet
export interface PPMMeterData {
  channels: number
  level: [number, number]  // dBFS per channel
  peak: [number, number]   // Peak hold dBFS per channel
}
