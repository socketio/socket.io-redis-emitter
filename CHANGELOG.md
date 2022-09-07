# [5.0.0](https://github.com/socketio/socket.io-redis-emitter/compare/4.1.1...5.0.0) (2022-09-07)

Important note! There is a non backward-compatible change regarding Date objects, which means that the adapter may not be able to properly decode them.

- Reference: https://github.com/darrachequesne/notepack/releases/tag/3.0.0
- Diff: https://github.com/darrachequesne/notepack/compare/2.3.0...3.0.1

### Features

* add support for the toJSON() method when encoding ([#113](https://github.com/socketio/socket.io-redis-emitter/issues/113)) ([3a6d94d](https://github.com/socketio/socket.io-redis-emitter/commit/3a6d94d0b87917f12d35e062a67e00bba581d005))



## [4.1.1](https://github.com/socketio/socket.io-redis-emitter/compare/4.1.0...4.1.1) (2022-01-04)


### Bug Fixes

* **typings:** fix namespace typed-events inheritance ([#108](https://github.com/socketio/socket.io-redis-emitter/issues/108)) ([53c73e1](https://github.com/socketio/socket.io-redis-emitter/commit/53c73e11661067b30cafa8f33a7ec0a61dcbd431))



# [4.1.0](https://github.com/socketio/socket.io-redis-emitter/compare/4.0.0...4.1.0) (2021-05-11)


### Features

* implement the serverSideEmit functionality ([5feabda](https://github.com/socketio/socket.io-redis-emitter/commit/5feabdac98f0ae44f30dcf36a29a8be328be139e))


# [4.0.0](https://github.com/socketio/socket.io-emitter/compare/3.2.0...4.0.0) (2021-03-17)

**Important note**: the name of the package was updated from `socket.io-emitter` to `@socket.io/redis-emitter` in order to better reflect the relationship with Redis.

### Features

* allow excluding all sockets in a room ([#92](https://github.com/socketio/socket.io-emitter/issues/92)) ([ad920e4](https://github.com/socketio/socket.io-emitter/commit/ad920e4ebe3cf616d5401944e2ba8b12b383d7ed))
* include features from Socket.IO v4 ([a70db12](https://github.com/socketio/socket.io-emitter/commit/a70db12877d901dd0f7085def0a91145b7c83163))
* rename the package to @socket/redis-emitter ([592883e](https://github.com/socketio/socket.io-emitter/commit/592883e9d85063411ffde760e0cdef10245e2573))


### BREAKING CHANGES

* the "redis" package is not installed by default anymore, you'll now need to create your own redis client and pass it to the Emitter constructor

Before:

```js
const io = require("socket.io-emitter")({ host: "127.0.0.1", port: 6379 });
```

After:

```js
const { Emitter } = require("@socket.io/redis-emitter");
const { createClient } = require("redis");

const redisClient = createClient();
const io = new Emitter(redisClient);
```

* `io.to()` is now immutable

Previously, broadcasting to a given room (by calling io.to()) would mutate the io instance, which could lead to surprising behaviors, like:

```js
io.to("room1");
io.to("room2").emit(/* ... */); // also sent to room1

// or with async/await
io.to("room3").emit("details", await fetchDetails()); // random behavior: maybe in room3, maybe to all clients
```

Calling `io.to()` (or any other broadcast modifier) will now return an immutable instance.



## [3.1.2](https://github.com/socketio/socket.io-emitter/compare/3.1.1...3.1.2) (2020-12-29)


### Bug Fixes

* **binary:** fix binary events being marked as regular events ([#76](https://github.com/socketio/socket.io-emitter/issues/76)) ([52483f9](https://github.com/socketio/socket.io-emitter/commit/52483f976982f45dc7335280a3ab4a8bf4a80aa9))
* handle missing namespace prefix ([03efd37](https://github.com/socketio/socket.io-emitter/commit/03efd372a0d584c3f44d4bcefd0ba475dd042fa8))



# [3.2.0](https://github.com/socketio/socket.io-emitter/compare/3.1.1...3.2.0) (2020-12-29)


### Bug Fixes

* handle missing namespace prefix ([03efd37](https://github.com/socketio/socket.io-emitter/commit/03efd372a0d584c3f44d4bcefd0ba475dd042fa8))



## [3.1.1](https://github.com/socketio/socket.io-emitter/compare/3.1.0...3.1.1) (2017-10-12)



# [3.1.0](https://github.com/socketio/socket.io-emitter/compare/3.0.1...3.1.0) (2017-08-03)


### Features

* add support for arraybuffer ([2672758](https://github.com/socketio/socket.io-emitter/commit/267275838034bd2016395c05a449b16f9ad29f20))



## [3.0.1](https://github.com/socketio/socket.io-emitter/compare/3.0.0...3.0.1) (2017-05-13)



# [3.0.0](https://github.com/socketio/socket.io-emitter/compare/2.0.0...3.0.0) (2017-05-13)


### Features

* make `of` return a new Emitter instance ([a3cbc84](https://github.com/socketio/socket.io-emitter/commit/a3cbc84b58d7acbb45ecd04c9d9d31e51e5750aa))
* make the module compatible with socket.io-redis 5.x ([119b3e6](https://github.com/socketio/socket.io-emitter/commit/119b3e68a45cdb6ad10a8e0c7f33a0d13fe48d0b)) (by @v4l3r10)



# [2.0.0](https://github.com/socketio/socket.io-emitter/compare/1.1.0...2.0.0) (2017-01-12)



# [1.1.0](https://github.com/socketio/socket.io-emitter/compare/1.0.0...1.1.0) (2017-01-12)



# [1.0.0](https://github.com/socketio/socket.io-emitter/compare/0.3.0...1.0.0) (2015-12-10)



# [0.3.0](https://github.com/socketio/socket.io-emitter/compare/0.2.0...0.3.0) (2015-12-09)



# [0.2.0](https://github.com/socketio/socket.io-emitter/compare/0.1.0...0.2.0) (2014-06-07)
