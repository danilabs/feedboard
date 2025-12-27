FROM golang:1.21-alpine AS builder
RUN apk add --no-cache gcc musl-dev
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=1 go build -o /authproxy .

FROM alpine:latest
RUN apk add --no-cache sqlite-libs
COPY --from=builder /authproxy /authproxy
VOLUME /data
EXPOSE 8091
ENTRYPOINT ["/authproxy"]
CMD ["-db", "/data/feedboard.db", "-secure-cookies"]
