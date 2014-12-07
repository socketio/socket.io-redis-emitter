
/**
 * Module dependencies.
 */

var client = require('redis').createClient;
var parser = require('socket.io-parser');
var hasBin = require('has-binary-data');
var msgpack = require('msgpack-js').encode;
var debug = require('debug')('socket.io-emitter');

/**
 * Module exports.
 */

module.exports = Emitter;

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
 * Socket.IO redis based emitter.
 *
 * @param {Object} redis client (optional)
 * @param {Object} options
 * @api public
 */

function Emitter(redis, opts){
  if (!(this instanceof Emitter)) return new Emitter(redis, opts);
  opts = opts || {};

  if ('string' == typeof redis) {
    redis = clientUri(redis);
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

  if (opts.pass) {
    redis.auth(opts.pass, function(err){
      if (err) throw err;
    });
  }

  this.redis = redis;
  this.key = (opts.key || 'socket.io') + '#emitter';

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
 * Limit emission to certain `namespace`.
 *
 * @param {String} namespace
 */

Emitter.prototype.of = function(nsp) {
  debug('nsp set to %s', nsp);
  this._flags.nsp = nsp;
  return this;
};

/**
 * Send the packet.
 *
 * @api private
 */

Emitter.prototype.emit = function(){
  // packet
  var args = Array.prototype.slice.call(arguments);
  var packet = {};
  packet.type = hasBin(args) ? parser.BINARY_EVENT : parser.EVENT;
  packet.data = args;
  // set namespace to packet
  if (this._flags.nsp) {
    packet.nsp = this._flags.nsp;
    delete this._flags.nsp;
  } else {
    packet.nsp = '/';
  }

  // publish
  this.redis.publish(this.key, msgpack([packet, {
    rooms: this._rooms,
    flags: this._flags
  }]));

  // reset state
  this._rooms = [];
  this._flags = {};

  return this;
};

/**
 * Create a redis client from a
 * `host:port` uri string.
 *
 * @param {String} uri
 * @return {Client} node client
 * @api private
 */

function clientUri(uri){
  uri = uri.split(':');
  return client(uri[1], uri[0]);
}
