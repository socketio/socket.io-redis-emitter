import debugModule from "debug";
import { PacketType } from "socket.io-parser";
import type {
  EventNames,
  EventParams,
  EventsMap,
  TypedEventBroadcaster,
} from "./typed-events";
import { UID, RESERVED_EVENTS, BroadcastFlags, BroadcastOptions } from "./util";

const debug = debugModule("socket.io-emitter");

/**
 * Request types, for messages between nodes
 */

export enum RequestType {
  SOCKETS = 0,
  ALL_ROOMS = 1,
  REMOTE_JOIN = 2,
  REMOTE_LEAVE = 3,
  REMOTE_DISCONNECT = 4,
  REMOTE_FETCH = 5,
  SERVER_SIDE_EMIT = 6,
}

export class BroadcastOperator<EmitEvents extends EventsMap>
  implements TypedEventBroadcaster<EmitEvents> {
  constructor(
    private readonly redisClient: any,
    private readonly broadcastOptions: BroadcastOptions,
    private readonly rooms: Set<string> = new Set<string>(),
    private readonly exceptRooms: Set<string> = new Set<string>(),
    private readonly flags: BroadcastFlags = {}
  ) {}

  /**
   * Targets a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public to(room: string | string[]): BroadcastOperator<EmitEvents> {
    const rooms = new Set(this.rooms);
    if (Array.isArray(room)) {
      room.forEach((r) => rooms.add(r));
    } else {
      rooms.add(room);
    }
    return new BroadcastOperator(
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
  public in(room: string | string[]): BroadcastOperator<EmitEvents> {
    return this.to(room);
  }

  /**
   * Excludes a room when emitting.
   *
   * @param room
   * @return a new BroadcastOperator instance
   * @public
   */
  public except(room: string | string[]): BroadcastOperator<EmitEvents> {
    const exceptRooms = new Set(this.exceptRooms);
    if (Array.isArray(room)) {
      room.forEach((r) => exceptRooms.add(r));
    } else {
      exceptRooms.add(room);
    }
    return new BroadcastOperator(
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
   * @return a new BroadcastOperator instance
   * @public
   */
  public compress(compress: boolean): BroadcastOperator<EmitEvents> {
    const flags = Object.assign({}, this.flags, { compress });
    return new BroadcastOperator(
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
   * @return a new BroadcastOperator instance
   * @public
   */
  public get volatile(): BroadcastOperator<EmitEvents> {
    const flags = Object.assign({}, this.flags, { volatile: true });
    return new BroadcastOperator(
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

    const opts = {
      rooms: [...this.rooms],
      flags: this.flags,
      except: [...this.exceptRooms],
    };

    const msg = this.broadcastOptions.parser.encode([UID, packet, opts]);
    let channel = this.broadcastOptions.broadcastChannel;
    if (this.rooms && this.rooms.size === 1) {
      channel += this.rooms.keys().next().value + "#";
    }

    debug("publishing message to channel %s", channel);

    this.redisClient.publish(channel, msg);

    return true;
  }

  /**
   * Makes the matching socket instances join the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsJoin(rooms: string | string[]): void {
    const request = JSON.stringify({
      type: RequestType.REMOTE_JOIN,
      opts: {
        rooms: [...this.rooms],
        except: [...this.exceptRooms],
      },
      rooms: Array.isArray(rooms) ? rooms : [rooms],
    });

    this.redisClient.publish(this.broadcastOptions.requestChannel, request);
  }

  /**
   * Makes the matching socket instances leave the specified rooms
   *
   * @param rooms
   * @public
   */
  public socketsLeave(rooms: string | string[]): void {
    const request = JSON.stringify({
      type: RequestType.REMOTE_LEAVE,
      opts: {
        rooms: [...this.rooms],
        except: [...this.exceptRooms],
      },
      rooms: Array.isArray(rooms) ? rooms : [rooms],
    });

    this.redisClient.publish(this.broadcastOptions.requestChannel, request);
  }

  /**
   * Makes the matching socket instances disconnect
   *
   * @param close - whether to close the underlying connection
   * @public
   */
  public disconnectSockets(close: boolean = false): void {
    const request = JSON.stringify({
      type: RequestType.REMOTE_DISCONNECT,
      opts: {
        rooms: [...this.rooms],
        except: [...this.exceptRooms],
      },
      close,
    });

    this.redisClient.publish(this.broadcastOptions.requestChannel, request);
  }
}
