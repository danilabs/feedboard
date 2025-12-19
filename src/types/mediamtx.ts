export interface MediaMTXPath {
  name: string
  confName: string
  source: MediaMTXSource | null
  ready: boolean
  readyTime: string | null
  tracks: string[]
  bytesReceived: number
  bytesSent: number
  readers: MediaMTXReader[]
}

export interface MediaMTXSource {
  type: string
  id: string
}

export interface MediaMTXReader {
  type: string
  id: string
}

export interface MediaMTXPathList {
  itemCount: number
  pageCount: number
  items: MediaMTXPath[]
}
