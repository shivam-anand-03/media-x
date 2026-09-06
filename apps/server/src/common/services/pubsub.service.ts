import Redis from "ioredis";

type MessageHandler = (data: any) => void;

export class PubSub {
  private publisher: Redis; // The Redis client used for publishing messages
  private subscriber: Redis; // The Redis client used for subscribing to channels

  constructor(publisher: Redis, subscriber: Redis) {
    this.publisher = publisher;
    this.subscriber = subscriber;
  }

  // Publish a message to a channel
  async publish(channel: string, payload: Record<string, any>) {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  // Subscribe to a channel and handle incoming messages
  subscribe(channel: string, handler: MessageHandler) {
    this.subscriber.subscribe(channel);

    this.subscriber.on("message", (ch, message) => {
      if (ch === channel) {
        handler(JSON.parse(message));
      }
    });
  }
}
