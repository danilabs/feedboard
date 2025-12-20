// Feedboard - MediaMTX Multiview Toolkit
// Web Components for video streaming

// Register all custom elements
import './elements/feedboard-player'
import './elements/feedboard-grid'
import './elements/feedboard-clock'
import './elements/feedboard-slate'
import './elements/feedboard-capture'
import './elements/feedboard-app'

// Export classes for programmatic use
export { FeedboardPlayer } from './elements/feedboard-player'
export { FeedboardGrid } from './elements/feedboard-grid'
export { FeedboardClock } from './elements/feedboard-clock'
export { FeedboardSlate } from './elements/feedboard-slate'
export { FeedboardCapture } from './elements/feedboard-capture'
export { FeedboardApp } from './elements/feedboard-app'

// Export utilities
export { MediaMTXClient } from './lib/mediamtx-api'
export { WhepClient } from './lib/whep-client'
export { WhipClient, getDevices, captureCamera, captureScreen } from './lib/whip-client'
export { HlsPlayer } from './lib/hls-player'

// Export config functions
export {
  getConfig,
  getApiUrl,
  getWebrtcUrl,
  getHlsUrl,
  buildWhepUrl,
  buildWhipUrl,
  buildHlsUrl,
} from './lib/config'

// Types
export type { MediaMTXPath, MediaMTXPathList } from './types/mediamtx'
