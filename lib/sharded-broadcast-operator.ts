import debugModule from "debug";
import { PacketType } from "socket.io-parser";
import type {
  EventNames,
  EventParams,
  EventsMap,
  TypedEventBroadcaster,
} from "./typed-events";
import {
  SPUBLISH,
  hasBinary,
  UID,
  RESERVED_EVENTS,
  BroadcastOptions,
} from "./util";

const debug = debugModule("socket.io-emitter");

export type Room = string;

interface ShardedBroadcastFlags {
  volatile?: boolean;
  compress?: boolean;
}

function encodeOptions(opts: {
  rooms: Set<Room>;
  except?: Set<Room>;
  flags?: ShardedBroadcastFlags;
}) {
  return {
    rooms: [...opts.rooms],
    except: [...opts.except],
    flags: opts.flags,
  };
}

export enum MessageType {
  INITIAL_HEARTBEAT = 1,
  HEARTBEAT,
  BROADCAST,
  SOCKETS_JOIN,
  SOCKETS_LEAVE,
  DISCONNECT_SOCKETS,
  FETCH_SOCKETS,
  FETCH_SOCKETS_RESPONSE,
  SERVER_SIDE_EMIT,
  SERVER_SIDE_EMIT_RESPONSE,
  BROADCAST_CLIENT_COUNT,
  BROADCAST_ACK,
}

export interface ClusterMessage {
  uid: string;
  type: MessageType;
  data?: Record<string, unknown>;
}

export class ShardedBroadcastOperator<EmitEvents extends EventsMap>
  implements TypedEventBroadcaster<EmitEvents> {
  constructor(
    private readonly redisClient: any,
    private readonly broadcastOptions: BroadcastOptions,
    private readonly rooms: Set<string> = new Set<string>(),
    private readonly exceptRooms: Set<string> = new Set<string>(),
    private readonly flags: ShardedBroadcastFlags = {}
  ) {}

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return a new ShardedBroadcastOperator instance
   * @public
   */
  public to(room: string | string[]): ShardedBroadcastOperator<EmitEvents> {
    const rooms = new Set(this.rooms);
    if (Array.isArray(room)) {
      room.forEach((r) => rooms.add(r));
    } else {
      rooms.add(room);
    }
    return new ShardedBroadcastOperator(
      this.redisClient,
      this.broadcastOptions,
      rooms,
      this.exceptRooms,
      this.flags
    );
  }

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public in(room: string | string[]): ShardedBroadcastOperator<EmitEvents> {
    return this.to(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return a new ShardedBroadcastOperator instance
   * @public
   */
  public except(room: string | string[]): ShardedBroadcastOperator<EmitEvents> {
    const exceptRooms = new Set(this.exceptRooms);
    if (Array.isArray(room)) {
      room.forEach((r) => exceptRooms.add(r));
    } else {
      exceptRooms.add(room);
    }
    return new ShardedBroadcastOperator(
      this.redisClient,
      this.broadcastOptions,
      this.rooms,
      exceptRooms,
      this.flags
    );
  }

  /**
   * Sets the compress flag.
   *
   * @param compress - if `true`, compresses the sending data
   * @return a new ShardedBroadcastOperator instance
   * @public
   */
  public compress(compress: boolean): ShardedBroadcastOperator<EmitEvents> {
    const flags = Object.assign({}, this.flags, { compress });
    return new ShardedBroadcastOperator(
      this.redisClient,
      this.broadcastOptions,
      this.rooms,
      this.exceptRooms,
      flags
    );
  }

  /**
   * Sets a modifier for a subsequent event emission that the event data may be lost if the client is not ready to
   * receive messages (because of network slowness or other issues, or because they’re connected through long polling
   * and is in the middle of a request-response cycle).
   *
   * @return a new ShardedBroadcastOperator instance
   * @public
   */
  public get volatile(): ShardedBroadcastOperator<EmitEvents> {
    const flags = Object.assign({}, this.flags, { volatile: true });
    return new ShardedBroadcastOperator(
      this.redisClient,
      this.broadcastOptions,
      this.rooms,
      this.exceptRooms,
      flags
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
    if (RESERVED_EVENTS.has(ev)) {
      throw new Error(`"${ev}" is a reserved event name`);
    }

    // set up packet object
    const data = [ev, ...args];
    const packet = {
      type: PacketType.EVENT,
      data: data,
      nsp: this.broadcastOptions.nsp,
    };

    const msg = {
      type: MessageType.BROADCAST,
      uid: UID,
      data: {
        packet,
        opts: encodeOptions({
          rooms: this.rooms,
          except: this.exceptRooms,
          flags: this.flags,
        }),
      },
    };

    this.publishMessage(msg);
    return true;
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsJoin(rooms: string | string[]): void {
    const msg = {
      type: MessageType.SOCKETS_JOIN,
      data: {
        opts: encodeOptions({
          rooms: this.rooms,
          except: this.exceptRooms,
          flags: this.flags,
        }),
        rooms,
      },
    };
    this.publishMessage(msg);
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsLeave(rooms: string | string[]): void {
    const msg = {
      type: MessageType.SOCKETS_LEAVE,
      data: {
        opts: encodeOptions({
          rooms: this.rooms,
          except: this.exceptRooms,
          flags: this.flags,
        }),
        rooms,
      },
    };
    this.publishMessage(msg);
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    const msg = {
      type: MessageType.DISCONNECT_SOCKETS,
      data: {
        opts: encodeOptions({
          rooms: this.rooms,
          except: this.exceptRooms,
          flags: this.flags,
        }),
        close,
      },
    };
    this.publishMessage(msg);
  }

  public publishMessage(message: Omit<ClusterMessage, "uid">) {
    const msg: ClusterMessage = {
      ...message,
      uid: UID,
    };
    const channel = this.computeChannel(message);
    debug("publishing message of type %s to %s", message.type, channel);
    SPUBLISH(this.redisClient, channel, this.encode(msg));
  }

  private encode(message: ClusterMessage) {
    const mayContainBinary = [
      MessageType.BROADCAST,
      MessageType.BROADCAST_ACK,
      MessageType.FETCH_SOCKETS_RESPONSE,
      MessageType.SERVER_SIDE_EMIT,
      MessageType.SERVER_SIDE_EMIT_RESPONSE,
    ].includes(message.type);

    if (mayContainBinary && hasBinary(message.data)) {
      return this.broadcastOptions.parser.encode(message);
    } else {
      return JSON.stringify(message);
    }
  }

  private computeChannel(message) {
    // broadcast with ack can not use a dynamic channel, because the serverCount() method return the number of all
    // servers, not only the ones where the given room exists
    const useDynamicChannel =
      this.broadcastOptions.subscriptionMode === "dynamic" &&
      message.type === MessageType.BROADCAST &&
      message.data.requestId === undefined &&
      message.data.opts.rooms.length === 1;
    if (useDynamicChannel) {
      return this.dynamicChannel(message.data.opts.rooms[0]);
    } else {
      return this.broadcastOptions.broadcastChannel;
    }
  }

  private dynamicChannel(room) {
    return this.broadcastOptions.broadcastChannel + room + "#";
  }
}
