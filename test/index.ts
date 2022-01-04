import expect = require("expect.js");
import { createClient, RedisClientType } from "redis";
import { Server, Socket } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer } from "http";
import { Emitter } from "..";
import type { AddressInfo } from "net";

import "./util";

const SOCKETS_COUNT = 3;

const createPartialDone = (
  count: number,
  done: () => void,
  callback?: () => void
) => {
  let i = 0;
  return () => {
    i++;
    if (i === count) {
      done();
      if (callback) {
        callback();
      }
    }
  };
};

describe("emitter", () => {
  let port: number,
    io: Server,
    pubClient: RedisClientType<any, any>,
    subClient: RedisClientType<any, any>,
    serverSockets: Socket[],
    clientSockets: ClientSocket[],
    emitter: Emitter;

  beforeEach(async () => {
    const httpServer = createServer();

    pubClient = createClient();
    subClient = createClient();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io = new Server(httpServer, {
      adapter: createAdapter(pubClient, subClient),
    });

    httpServer.listen(() => {
      port = (httpServer.address() as AddressInfo).port;
      clientSockets = [];
      for (let i = 0; i < SOCKETS_COUNT; i++) {
        clientSockets.push(ioc(`http://localhost:${port}`));
      }
    });

    serverSockets = [];

    emitter = new Emitter(pubClient);

    return new Promise((resolve) => {
      io.on("connection", (socket) => {
        serverSockets.push(socket);
        if (serverSockets.length === SOCKETS_COUNT) {
          setTimeout(resolve, 100);
        }
      });
    });
  });

  afterEach(() => {
    pubClient.quit();
    subClient.quit();
    io.close();
    clientSockets.forEach((socket) => {
      socket.disconnect();
    });
  });

  it("should be able to emit any kind of data", (done) => {
    const buffer = Buffer.from("asdfasdf", "utf8");
    const arraybuffer = Uint8Array.of(1, 2, 3, 4).buffer;

    emitter.emit("payload", 1, "2", [3], buffer, arraybuffer);

    clientSockets[0].on("payload", (a, b, c, d, e) => {
      expect(a).to.eql(1);
      expect(b).to.eql("2");
      expect(c).to.eql([3]);
      expect(d).to.eql(buffer);
      expect(e).to.eql(Buffer.from(arraybuffer)); // buffer on the nodejs client-side
      done();
    });
  });

  it("should support all broadcast modifiers", () => {
    emitter.in(["room1", "room2"]).emit("test");
    emitter.except(["room4", "room5"]).emit("test");
    emitter.volatile.emit("test");
    emitter.compress(false).emit("test");
    expect(() => emitter.emit("connect")).to.throwError();
  });

  describe("in namespaces", () => {
    it("should be able to emit messages to client", (done) => {
      emitter.emit("broadcast event", "broadcast payload");

      clientSockets[0].on("broadcast event", (payload) => {
        expect(payload).to.eql("broadcast payload");
        done();
      });
    });

    it("should be able to emit message to namespace", (done) => {
      io.of("/custom");

      const clientSocket = ioc(`http://localhost:${port}/custom`);

      clientSocket.on("broadcast event", (payload) => {
        expect(payload).to.eql("broadcast payload");
        clientSocket.disconnect();
        done();
      });

      clientSockets[0].on("broadcast event", () => {
        expect().fail();
      });

      clientSocket.on("connect", () => {
        emitter.of("/custom").emit("broadcast event", "broadcast payload");
      });
    });

    it("should prepend a missing / to the namespace name", () => {
      const emitter = new Emitter(null);
      const custom = emitter.of("custom"); // missing "/"
      expect(emitter.nsp).to.eql("/");
      expect(custom.nsp).to.eql("/custom");
    });
  });

  describe("in rooms", () => {
    it("should be able to emit to a room", (done) => {
      serverSockets[0].join("room1");
      serverSockets[1].join("room2");

      clientSockets[0].on("broadcast event", () => {
        done();
      });

      clientSockets[1].on("broadcast event", () => {
        expect().fail();
      });

      emitter.to("room1").emit("broadcast event", "broadcast payload");
    });

    it("should be able to emit to a socket by id", (done) => {
      clientSockets[0].on("broadcast event", () => {
        done();
      });

      clientSockets[1].on("broadcast event", () => {
        expect().fail();
      });

      emitter
        .to(serverSockets[0].id)
        .emit("broadcast event", "broadcast payload");
    });

    it("should be able to exclude a socket by id", (done) => {
      clientSockets[0].on("broadcast event", () => {
        done();
      });

      clientSockets[1].on("broadcast event", () => {
        expect().fail();
      });

      emitter
        .except(serverSockets[1].id)
        .emit("broadcast event", "broadcast payload");
    });
  });

  describe("utility methods", () => {
    describe("socketsJoin", () => {
      it("makes all socket instances join the given room", (done) => {
        emitter.socketsJoin("room1");

        setTimeout(() => {
          serverSockets.forEach((socket) => {
            expect(socket.rooms).to.contain("room1");
          });
          done();
        }, 100);
      });

      it("makes all socket instances in a room join the given room", (done) => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");

        emitter.in("room1").socketsJoin("room3");

        setTimeout(() => {
          expect(serverSockets[0].rooms).to.contain("room3");
          expect(serverSockets[1].rooms).to.contain("room3");
          expect(serverSockets[2].rooms).to.not.contain("room3");
          done();
        }, 100);
      });
    });

    describe("socketsLeave", () => {
      it("makes all socket instances leave the given room", (done) => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");

        emitter.socketsLeave("room1");

        setTimeout(() => {
          expect(serverSockets[0].rooms).to.contain("room2");
          expect(serverSockets[0].rooms).to.not.contain("room1");
          expect(serverSockets[1].rooms).to.not.contain("room1");
          done();
        }, 100);
      });

      it("makes all socket instances in a room leave the given room", (done) => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");

        emitter.in("room2").socketsLeave("room1");

        setTimeout(() => {
          expect(serverSockets[0].rooms).to.contain("room2");
          expect(serverSockets[0].rooms).to.not.contain("room1");
          expect(serverSockets[1].rooms).to.contain("room1");
          done();
        }, 100);
      });
    });

    describe("disconnectSockets", () => {
      it("makes all socket instances disconnect", (done) => {
        emitter.disconnectSockets(true);

        const partialDone = createPartialDone(3, done);

        clientSockets[0].on("disconnect", partialDone);
        clientSockets[1].on("disconnect", partialDone);
        clientSockets[2].on("disconnect", partialDone);
      });

      it("makes all socket instances in a room disconnect", (done) => {
        serverSockets[0].join(["room1", "room2"]);
        serverSockets[1].join("room1");
        serverSockets[2].join("room2");
        emitter.in("room2").disconnectSockets(true);

        const partialDone = createPartialDone(2, done, () => {
          clientSockets[1].off("disconnect");
        });

        clientSockets[0].on("disconnect", partialDone);
        clientSockets[1].on("disconnect", () => {
          done(new Error("should not happen"));
        });
        clientSockets[2].on("disconnect", partialDone);
      });
    });

    describe("serverSideEmit", () => {
      it("sends an event to other server instances", (done) => {
        emitter.serverSideEmit("hello", "world", 1, "2");

        io.on("hello", (arg1, arg2, arg3) => {
          expect(arg1).to.eql("world");
          expect(arg2).to.eql(1);
          expect(arg3).to.eql("2");
          done();
        });
      });
    });
  });
});
