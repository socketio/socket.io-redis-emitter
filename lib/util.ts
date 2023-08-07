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

/**
 * Whether sharded publish using `redis` or `iosredis` package
 * @param redisClient
 * @param channel
 * @param payload
 */
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

/**
 * Whether publish in sharded mode.
 * @param redisClient
 * @param channel
 * @param payload
 * @param sharded
 */
export function PUBLISH(
  redisClient: any,
  channel: string,
  payload: string | Uint8Array,
  sharded: boolean
) {
  if (sharded) {
    SPUBLISH(redisClient, channel, payload);
  } else {
    redisClient.publish(channel, payload);
  }
}
