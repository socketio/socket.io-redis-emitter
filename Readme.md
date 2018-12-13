
# socket.io-emitter

[![Build Status](https://travis-ci.org/socketio/socket.io-emitter.svg?branch=master)](https://travis-ci.org/socketio/socket.io-emitter)
[![NPM version](https://badge.fury.io/js/socket.io-emitter.svg)](http://badge.fury.io/js/socket.io-emitter)

`socket.io-emitter` allows you to communicate with socket.io servers easily and effectively to redis/redis.cluster via pub/sub.

## Redis Pub/Sub: [node_redis](https://redis.io/topics/pubsub)

## How to use

```js
var io = require('socket.io-emitter')({
  host: '127.0.0.1',
  port: 6379
});

setInterval(function() {
  io.emit('time', new Date);
}, 5000);
```

```js
// Multiple construction options.

// 1) Initialize with host:port string.
var io = require('socket.io-emitter')("localhost:6379");

// 2) Initialize with host, port JSON object.
var io = require('socket.io-emitter')({
  host: '127.0.0.1',
  port: 6379
});

// 3) Initialize with an existing node-redis compatible client instance. eg. ioredis.
var IoRedis = require("ioredis");
var redis = new IoRedis();
var io = require('socket.io-emitter')(redis);

// 4) Initialize with Redis.Clustered instance.
var cluster = new Redis.Cluster([{
  host: "localhost",
  port: 6379
}, {
  host: "localhost",
  port: 6378
}]);
var io = require('socket.io-emitter')(cluster);
```

## Examples

```js
// Initialize.
var io = require('socket.io-emitter')({
  host: '127.0.0.1',
  port: 6379
});

// Broadcasting to all clients.
io.emit('broadcast', /* ... */);

// Sending to all clients in 'game' room.
io.to('game').emit('new-game', /* ... */);

// Sending to an individual socketid (ie. private message)
io.to(<socketid>).emit('private', /* ... */);

// Dealing with the 'admin' namespace.
var nsp = io.of('/admin');

// Sending to all clients in the 'admin' namespace.
nsp.emit('namespace', /* ... */);

// Sending to all clients in the 'admin' namespace, within the 'notifications' room.
nsp.to('notifications').emit('namespace', /* ... */);
```

**Please Note:** Acknowledgements are not currently supported.

## Error handling

Access the `redis` to subscribe to its `error` event:

```js
var emitter = require('socket.io-emitter')("localhost:6379");

emitter.redis.on('error', onError);

function onError(err){
  console.log(err);
}
```

## API

### Emitter(client)

`client` is a [node_redis](https://github.com/mranney/node_redis)
compatible client that has been initialized with the `return_buffers` option set to `true`.

### Emitter(clientUri)

`clientUri` is a redis connection string in `host:port` format. eg.`localhost:6379`.

### Emitter(opts)

`host`: redis connection host (required: `localhost`)
`port`: redis connection port (required: `6379`)
`key`: redis pub/sub prefix key name for events (default: `socket.io`)
`socket`: redis connection unix domain socket (default: `"/tmp/redis.sock"`)

### Emitter#to(room:String):Emitter / Emitter#in(room:String):Emitter

Specifies a specific `room` to emit.

### Emitter#of(namespace:String):Emitter

Specifies a specific namespace to emit.

## License

MIT
