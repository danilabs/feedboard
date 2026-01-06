#!/bin/bash
# Test Streams for Feedboard Development
#
# Adds test streams to MediaMTX via API. Streams run continuously.
#
# Usage:
#   ./dev/test-streams.sh         # Add all test streams (default)
#   ./dev/test-streams.sh add     # Add all test streams
#   ./dev/test-streams.sh remove  # Remove all test streams
#   ./dev/test-streams.sh list    # List current paths
#
# Environment:
#   MEDIAMTX_API  - MediaMTX API URL (default: http://localhost:9997)

API="${MEDIAMTX_API:-http://localhost:9997}/v3/config/paths"

# Test stream definitions
# Format: name|description|video_filter|audio_freq
STREAMS=(
  "test_bars|SMPTE HD bars + 1kHz tone|smptehdbars=rate=30:size=1920x1080|1000"
  "testsrc|Test pattern with timecode|testsrc2=rate=30:size=1920x1080|440"
  "gradient|Animated color gradient|gradients=size=1920x1080:rate=30:speed=0.5|880"
  "pal_bars|PAL 75% color bars|pal75bars=rate=30:size=1920x1080|1000"
  "color_red|Solid red|color=c=red:size=1920x1080:rate=30|523"
  "color_green|Solid green|color=c=green:size=1920x1080:rate=30|659"
  "color_blue|Solid blue|color=c=blue:size=1920x1080:rate=30|784"
)

add_stream() {
  local name="$1"
  local video="$2"
  local freq="$3"

  # Build the ffmpeg command (no quotes needed around lavfi inputs)
  # Uses internal service account for authenticated publish
  local cmd="ffmpeg -re -f lavfi -i ${video} -f lavfi -i sine=frequency=${freq}:sample_rate=48000 -pix_fmt yuv420p -c:v libx264 -preset ultrafast -tune zerolatency -b:v 5000k -c:a aac -b:a 128k -f rtsp rtsp://internal:\$INTERNAL_PUBLISH_TOKEN@localhost:\$RTSP_PORT/\$MTX_PATH"

  # Use a heredoc to avoid JSON escaping issues
  curl -s -X POST "${API}/add/${name}" \
    -H "Content-Type: application/json" \
    --data-binary @- <<EOF
{
  "source": "publisher",
  "runOnInit": "$cmd",
  "runOnInitRestart": true
}
EOF
}

remove_stream() {
  local name="$1"
  curl -s -X DELETE "${API}/remove/${name}" > /dev/null
}

cmd_add() {
  echo "Adding test streams to ${API}..."
  for stream in "${STREAMS[@]}"; do
    IFS='|' read -r name desc video freq <<< "$stream"
    if add_stream "$name" "$video" "$freq"; then
      echo "  + ${name} - ${desc}"
    else
      echo "  ! ${name} - failed"
    fi
  done
  echo ""
  echo "Done. All streams are now running."
}

cmd_remove() {
  echo "Removing test streams..."
  for stream in "${STREAMS[@]}"; do
    IFS='|' read -r name _ _ _ <<< "$stream"
    remove_stream "$name"
    echo "  - ${name}"
  done
  echo "Done."
}

cmd_list() {
  echo "Current MediaMTX paths:"
  curl -s "http://localhost:9997/v3/paths/list" | python3 -m json.tool 2>/dev/null || \
    curl -s "http://localhost:9997/v3/paths/list"
}

case "${1:-add}" in
  add)
    cmd_add
    ;;
  remove)
    cmd_remove
    ;;
  list)
    cmd_list
    ;;
  *)
    echo "Usage: $0 {add|remove|list}"
    echo ""
    echo "Available test streams:"
    for stream in "${STREAMS[@]}"; do
      IFS='|' read -r name desc _ _ <<< "$stream"
      printf "  %-14s %s\n" "${name}" "${desc}"
    done
    exit 1
    ;;
esac
