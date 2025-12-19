export type WhipStatus = 'idle' | 'connecting' | 'publishing' | 'error'

export class WhipClient {
  private pc: RTCPeerConnection | null = null
  private resourceUrl: string | null = null
  private stream: MediaStream | null = null

  constructor(private url: string) {}

  async publish(stream: MediaStream): Promise<void> {
    this.stream = stream

    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    // Add tracks from the stream
    stream.getTracks().forEach((track) => {
      this.pc!.addTrack(track, stream)
    })

    // Create offer
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    // Wait for ICE gathering
    await this.waitForIceGathering()

    // Send offer to WHIP endpoint
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: this.pc.localDescription!.sdp,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`WHIP failed: ${response.status} ${errorText}`)
    }

    // Store resource URL for cleanup
    this.resourceUrl = response.headers.get('Location') || null

    // Set remote description
    const answerSdp = await response.text()
    await this.pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    })
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc!.iceGatheringState === 'complete') {
        resolve()
        return
      }

      const checkState = () => {
        if (this.pc!.iceGatheringState === 'complete') {
          this.pc!.removeEventListener('icegatheringstatechange', checkState)
          resolve()
        }
      }

      this.pc!.addEventListener('icegatheringstatechange', checkState)
      setTimeout(resolve, 2000)
    })
  }

  disconnect(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    if (this.resourceUrl) {
      fetch(this.resourceUrl, { method: 'DELETE' }).catch(() => {})
      this.resourceUrl = null
    }
  }

  getStats(): Promise<RTCStatsReport> | null {
    return this.pc?.getStats() || null
  }

  isConnected(): boolean {
    return this.pc?.connectionState === 'connected'
  }
}

// Capture utilities
export async function getDevices(): Promise<{
  cameras: MediaDeviceInfo[]
  microphones: MediaDeviceInfo[]
}> {
  // Need to get permission first to see device labels
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    stream.getTracks().forEach((t) => t.stop())
  } catch {}

  const devices = await navigator.mediaDevices.enumerateDevices()
  return {
    cameras: devices.filter((d) => d.kind === 'videoinput'),
    microphones: devices.filter((d) => d.kind === 'audioinput'),
  }
}

export async function captureCamera(options?: {
  videoDeviceId?: string
  audioDeviceId?: string
  width?: number
  height?: number
}): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: options?.videoDeviceId
      ? { deviceId: { exact: options.videoDeviceId }, width: { ideal: options?.width || 1920 }, height: { ideal: options?.height || 1080 } }
      : { width: { ideal: options?.width || 1920 }, height: { ideal: options?.height || 1080 } },
    audio: options?.audioDeviceId
      ? { deviceId: { exact: options.audioDeviceId } }
      : true,
  })
}

export async function captureScreen(withAudio = true): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({
    video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: withAudio,
  })
}
