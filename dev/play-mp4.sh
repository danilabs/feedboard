#!/bin/bash
# Stream MP4 to RTMP server (loops forever)
# Usage: ./play-mp4.sh video.mp4 [streamname]

VIDEO="$1"
STREAM="${2:-test}"
RTMP_SERVER="${RTMP_SERVER:-rtmp://localhost:1935}"

if [ -z "$VIDEO" ] || [ ! -f "$VIDEO" ]; then
  echo "Usage: $0 <video.mp4> [streamname]"
  echo "  RTMP_SERVER=rtmp://host:1935 $0 video.mp4 mystream"
  exit 1
fi

echo "Streaming $VIDEO to $RTMP_SERVER/$STREAM (looping)"
echo "Press Ctrl+C to stop"

ffmpeg -stream_loop -1 -re -i "$VIDEO" \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset veryfast -tune zerolatency -b:v 4000k \
  -c:a aac -b:a 128k \
  -f flv "$RTMP_SERVER/$STREAM"
