export class WhepClient {
  private pc: RTCPeerConnection | null = null
  private resourceUrl: string | null = null
  private token: string | null = null

  constructor(private url: string, token?: string | null) {
    this.token = token ?? null
  }

  setToken(token: string | null): void {
    this.token = token
  }

  async connect(): Promise<MediaStream> {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    // Add transceivers to receive audio and video
    this.pc.addTransceiver('video', { direction: 'recvonly' })
    this.pc.addTransceiver('audio', { direction: 'recvonly' })

    // Create offer
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    // Wait for ICE gathering
    await this.waitForIceGathering()

    // Build URL with optional JWT token
    let whepUrl = this.url
    if (this.token) {
      const separator = whepUrl.includes('?') ? '&' : '?'
      whepUrl = `${whepUrl}${separator}jwt=${encodeURIComponent(this.token)}`
    }

    // Send offer to WHEP endpoint
    const response = await fetch(whepUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: this.pc.localDescription!.sdp,
    })

    if (!response.ok) {
      throw new Error(`WHEP request failed: ${response.status}`)
    }

    // Store resource URL for cleanup
    this.resourceUrl = response.headers.get('Location') || null

    // Set remote description
    const answerSdp = await response.text()
    await this.pc.setRemoteDescription({
      type: 'answer',
      sdp: answerSdp,
    })

    // Get the media stream from receivers
    const stream = new MediaStream()
    this.pc.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        stream.addTrack(receiver.track)
      }
    })

    return stream
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

      // Timeout fallback
      setTimeout(resolve, 2000)
    })
  }

  disconnect(): void {
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    // DELETE resource if we have a URL
    if (this.resourceUrl) {
      fetch(this.resourceUrl, { method: 'DELETE' }).catch(() => {})
      this.resourceUrl = null
    }
  }

  getStats(): Promise<RTCStatsReport> | null {
    return this.pc?.getStats() || null
  }
}
