import type { MediaMTXPath, MediaMTXPathList } from '@/types/mediamtx'

export class MediaMTXClient {
  constructor(private apiUrl: string) {}

  async listPaths(): Promise<MediaMTXPath[]> {
    const res = await fetch(`${this.apiUrl}/v3/paths/list`)
    if (!res.ok) {
      throw new Error(`Failed to list paths: ${res.status}`)
    }
    const data: MediaMTXPathList = await res.json()
    return data.items || []
  }

  async getPath(name: string): Promise<MediaMTXPath> {
    const res = await fetch(`${this.apiUrl}/v3/paths/get/${encodeURIComponent(name)}`)
    if (!res.ok) {
      throw new Error(`Failed to get path: ${res.status}`)
    }
    return res.json()
  }

  buildWhepUrl(path: string, whepBaseUrl: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${whepBaseUrl}/${cleanPath}/whep`
  }

  buildHlsUrl(path: string, hlsBaseUrl: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${hlsBaseUrl}/${cleanPath}/index.m3u8`
  }
}
