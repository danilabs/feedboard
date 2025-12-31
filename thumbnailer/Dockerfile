# Thumbnailer - Stream thumbnail generator
#
# Build:
#   docker build -t feedboard-thumbnailer ./thumbnailer
#
# Run:
#   docker run -p 8090:8090 feedboard-thumbnailer \
#     -mediamtx-api=http://mediamtx:9997 \
#     -mediamtx-rtsp=rtsp://mediamtx:8554

FROM golang:1.21-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY index.html ./
RUN CGO_ENABLED=0 go build -o thumbnailer .

FROM alpine:3.19
RUN apk add --no-cache ffmpeg
COPY --from=build /app/thumbnailer /usr/local/bin/thumbnailer
EXPOSE 8090
ENTRYPOINT ["thumbnailer"]
CMD ["-port=8090"]
