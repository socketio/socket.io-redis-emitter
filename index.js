
/**
 * Module dependencies.
 */

var uid2 = require('uid2');
var client = require('redis').createClient;
var parser = require('socket.io-parser');
var msgpack = require('notepack.io');
var debug = require('debug')('socket.io-emitter');

/**
 * Module exports.
 */

module.exports = init;

/**
 * Request Types
 * **NOTE** Currently only using remoteDisconnect
 * https://github.com/socketio/socket.io-redis/blob/72fe98ed948acc0f86c4f86c7636befdf8720c24/lib/index.ts#L19
 */
var RequestType = {
  SOCKETS: 0,
  ALL_ROOMS: 1,
  REMOTE_JOIN: 2,
  REMOTE_LEAVE: 3,
  REMOTE_DISCONNECT: 4
};

/**
 * Flags.
 *
 * @api public
 */

var flags = [
  'json',
  'volatile',
  'broadcast'
];

/**
 * uid for emitter
 *
 * @api private
 */

var uid = 'emitter';

/**
 * Socket.IO redis based emitter.
 *
 * @param {Object} redis client (optional)
 * @param {Object} options
 * @api public
 */

function init(redis, opts){
  opts = opts || {};

  if ('string' == typeof redis) {
    redis = client(redis);
  }

  if (redis && !redis.hset) {
    opts = redis;
    redis = null;
  }

  if (!redis) {
    if (!opts.socket && !opts.host) throw new Error('Missing redis `host`');
    if (!opts.socket && !opts.port) throw new Error('Missing redis `port`');
    redis = opts.socket
      ? client(opts.socket)
      : client(opts.port, opts.host);
  }

  var prefix = opts.key || 'socket.io';

  return new Emitter(redis, prefix, '/');
}

function Emitter(redis, prefix, nsp){
  this.redis = redis;
  this.prefix = prefix;
  this.nsp = nsp;
  this.channel = this.prefix + '#' + nsp + '#';
  this.requestChannel = this.prefix + '-request#' + nsp + '#';


  this._rooms = [];
  this._flags = {};
}

/**
 * Apply flags from `Socket`.
 */

flags.forEach(function(flag){
  Emitter.prototype.__defineGetter__(flag, function(){
    debug('flag %s on', flag);
    this._flags[flag] = true;
    return this;
  });
});

/**
 * Limit emission to a certain `room`.
 *
 * @param {String} room
 */

Emitter.prototype.in =
Emitter.prototype.to = function(room){
  if (!~this._rooms.indexOf(room)) {
    debug('room %s', room);
    this._rooms.push(room);
  }
  return this;
};

/**
 * Return a new emitter for the given namespace.
 *
 * @param {String} namespace
 */

Emitter.prototype.of = function(nsp){
  return new Emitter(this.redis, this.prefix, (nsp[0] !== "/" ? "/" : "") + nsp);
};

/**
 * Send the packet.
 *
 * @api public
 */

Emitter.prototype.emit = function(){
  // packet
  var args = Array.prototype.slice.call(arguments);
  var packet = { type: parser.EVENT, data: args, nsp: this.nsp };

  var opts = {
    rooms: this._rooms,
    flags: this._flags
  };

  var msg = msgpack.encode([uid, packet, opts]);
  var channel = this.channel;
  if (opts.rooms && opts.rooms.length === 1) {
    channel += opts.rooms[0] + '#';
  }
  debug('publishing message to channel %s', channel);
  this.redis.publish(channel, msg);

  // reset state
  this._rooms = [];
  this._flags = {};

  return this;
};

Emitter.prototype.remoteDisconnect = function(id) {
  const requestId = uid2(6);

  const request = JSON.stringify({
    requestId: requestId,
    type: RequestType.REMOTE_DISCONNECT,
    sid: id,
    close: true,
  });

  this.redis.publish(this.requestChannel, request);

}