
# socket.io-emitter

[![Build Status](https://travis-ci.org/socketio/socket.io-emitter.svg?branch=master)](https://travis-ci.org/socketio/socket.io-emitter)
[![NPM version](https://badge.fury.io/js/socket.io-emitter.svg)](http://badge.fury.io/js/socket.io-emitter)

`socket.io-emitter` allows you to communicate with socket.io servers
easily from non-socket.io processes.

## How to use

```js
var io = require('socket.io-emitter')({ host: '127.0.0.1', port: 6379 });
setInterval(function(){
  io.emit('time', new Date);
}, 5000);
```
```js
// Different constructor options.

//1. Initialize with host:port string
var io = require('socket.io-emitter')("localhost:6379")
// 2. Initlize with host, port object.
var io = require('socket.io-emitter')({ host: '127.0.0.1', port: 6379 });
// 3. Can use other node_redis compatible client eg; ioredis.

var Redis = require("ioredis");
var redis = new Redis();
var io = require('socket.io-emitter')(redis);

// Make the emitter works with redis clustered environment.
var Cluster = new Redis.Cluster([
    {
        host: "localhost",
        port: 6379
    },
    {
        host: "localhost",
        port: 6378
    },
]);
var io = require('socket.io-emitter')(Cluster);

```

## Examples

```js
  var io = require('socket.io-emitter')({ host: '127.0.0.1', port: 6379 });

  // sending to all clients
  io.emit('broadcast', /* ... */);

  // sending to all clients in 'game' room
  io.to('game').emit('new-game', /* ... */);

  // sending to individual socketid (private message)
  io.to(<socketid>).emit('private', /* ... */);

  var nsp = io.of('/admin');

  // sending to all clients in 'admin' namespace
  nsp.emit('namespace', /* ... */);

  // sending to all clients in 'admin' namespace and in 'notifications' room
  nsp.to('notifications').emit('namespace', /* ... */);
```

**Note:** acknowledgements are not supported

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

### Emitter(client[, opts])

`client` is a [node_redis](https://github.com/mranney/node_redis)
compatible client that has been initialized with the `return_buffers`
option set to `true`. This argument is optional.

The following options are allowed:

- `key`: the name of the key to pub/sub events on as prefix (`socket.io`)
- `host`: host to connect to redis on (`localhost`)
- `port`: port to connect to redis on (`6379`)
- `socket`: unix domain socket to connect to redis on (`"/tmp/redis.sock"`)

### Emitter(clientUri[, opts]

Same as above, but `clientUri` is a string of the format `host:port`
to connect to redis to.

### Emitter(opts)

If you don't want to supply a redis client object, and want
`socket.io-emitter` to intiialize one for you, make sure to supply the
`host` and `port` options.

### Emitter#to(room:String):Emitter
### Emitter#in(room:String):Emitter

Specifies a specific `room` that you want to emit to.


### Emitter#of(namespace:String):Emitter

Specifies a specific namespace that you want to emit to.

## License

MIT
