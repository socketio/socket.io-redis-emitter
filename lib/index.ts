import msgpack = require("notepack.io");
import type {
  DefaultEventsMap,
  EventNames,
  EventParams,
  EventsMap,
  TypedEventBroadcaster,
} from "./typed-events";
import { Parser, UID, BroadcastOptions } from "./util";
import { BroadcastOperator, RequestType } from "./broadcast-operator";
import {
  ShardedBroadcastOperator,
  MessageType,
} from "./sharded-broadcast-operator";

export interface EmitterOptions {
  /**
   * @default "socket.io"
   */
  key?: string;
  /**
   * The parser to use for encoding messages sent to Redis.
   * Defaults to notepack.io, a MessagePack implementation.
   */
  parser?: Parser;

  sharded?: boolean;
  subscriptionMode?: string;
}

export class Emitter<EmitEvents extends EventsMap = DefaultEventsMap> {
  private readonly opts: EmitterOptions;
  private readonly broadcastOptions: BroadcastOptions;

  constructor(
    readonly redisClient: any,
    opts?: EmitterOptions,
    readonly nsp: string = "/"
  ) {
    this.opts = Object.assign(
      {
        key: "socket.io",
        parser: msgpack,
      },
      opts
    );
    this.broadcastOptions = {
      nsp,
      broadcastChannel: this.opts.key + "#" + nsp + "#",
      requestChannel: this.opts.key + "-request#" + nsp + "#",
      parser: this.opts.parser,
    };
    if (this.opts.sharded) {
      this.broadcastOptions = Object.assign(this.broadcastOptions, {
        subscriptionMode: this.opts.subscriptionMode ?? "dynamic",
      });
    }
  }

  /**
   * Return a new emitter for the given namespace.
   *
   * @param nsp - namespace
   * @public
   */
  public of(nsp: string): Emitter<EmitEvents> {
    return new Emitter(
      this.redisClient,
      this.opts,
      (nsp[0] !== "/" ? "/" : "") + nsp
    );
  }

  /**
   * Emits to all clients.
   *
   * @return Always true
   * @public
   */
  public emit<Ev extends EventNames<EmitEvents>>(
    ev: Ev,
    ...args: EventParams<EmitEvents, Ev>
  ): true {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).emit(ev, ...args);
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return BroadcastOperator
   * @public
   */
  public to(room: string | string[]): TypedEventBroadcaster<EmitEvents> {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).to(room);
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return BroadcastOperator
   * @public
   */
  public in(room: string | string[]): TypedEventBroadcaster<EmitEvents> {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).in(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return BroadcastOperator
   * @public
   */
  public except(room: string | string[]): TypedEventBroadcaster<EmitEvents> {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).except(room);
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return BroadcastOperator
   * @public
   */
  public get volatile(): TypedEventBroadcaster<EmitEvents> {
    return this.newBroadcastOperator(this.redisClient, this.broadcastOptions)
      .volatile;
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return BroadcastOperator
   * @public
   */
  public compress(compress: boolean): TypedEventBroadcaster<EmitEvents> {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).compress(compress);
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsJoin(rooms: string | string[]): void {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).socketsJoin(rooms);
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsLeave(rooms: string | string[]): void {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).socketsLeave(rooms);
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    return this.newBroadcastOperator(
      this.redisClient,
      this.broadcastOptions
    ).disconnectSockets(close);
  }

  /**
   * Send a packet to the Socket.IO servers in the cluster
   *
   * @param args - any number of serializable arguments
   */
  public serverSideEmit(...args: any[]): void {
    const withAck = typeof args[args.length - 1] === "function";

    if (withAck) {
      throw new Error("Acknowledgements are not supported");
    }

    if (this.opts.sharded) {
      const shardedMessage = {
        uid: UID,
        type: MessageType.SERVER_SIDE_EMIT,
        data: {
          packet: args,
        },
      };
      const broadcaster = this.newBroadcastOperator(
        this.redisClient,
        this.broadcastOptions
      ) as ShardedBroadcastOperator<EmitEvents>;
      broadcaster.publishMessage(shardedMessage);
    } else {
      const request = JSON.stringify({
        uid: UID,
        type: RequestType.SERVER_SIDE_EMIT,
        data: args,
      });
      this.redisClient.publish(this.broadcastOptions.requestChannel, request);
    }
  }

  private newBroadcastOperator(
    redisClient: any,
    broadcastOptions: any
  ): TypedEventBroadcaster<EmitEvents> {
    return this.opts.sharded
      ? new ShardedBroadcastOperator<EmitEvents>(redisClient, broadcastOptions)
      : new BroadcastOperator<EmitEvents>(redisClient, broadcastOptions);
  }
}
