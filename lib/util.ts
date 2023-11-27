export const UID = "emitter";

export interface Parser {
  encode: (msg: any) => any;
}

export interface BroadcastFlags {
  volatile?: boolean;
  compress?: boolean;
}

export const RESERVED_EVENTS: ReadonlySet<string | Symbol> = new Set(<const>[
  "connect",
  "connect_error",
  "disconnect",
  "disconnecting",
  "newListener",
  "removeListener",
]);

export interface BroadcastOptions {
  nsp: string;
  broadcastChannel: string;
  requestChannel: string;
  parser: Parser;
  subscriptionMode?: string;
}

/**
 * Whether the client comes from the `redis` package
 *
 * @param redisClient
 *
 * @see https://github.com/redis/node-redis
 */
function isRedisV4Client(redisClient: any) {
  return typeof redisClient.sSubscribe === "function";
}

export function SPUBLISH(
  redisClient: any,
  channel: string,
  payload: string | Uint8Array
) {
  if (isRedisV4Client(redisClient)) {
    redisClient.sPublish(channel, payload);
  } else {
    redisClient.spublish(channel, payload);
  }
}

export function hasBinary(obj: any, toJSON?: boolean): boolean {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
    return true;
  }

  if (Array.isArray(obj)) {
    for (let i = 0, l = obj.length; i < l; i++) {
      if (hasBinary(obj[i])) {
        return true;
      }
    }
    return false;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
      return true;
    }
  }

  if (obj.toJSON && typeof obj.toJSON === "function" && !toJSON) {
    return hasBinary(obj.toJSON(), true);
  }

  return false;
}
