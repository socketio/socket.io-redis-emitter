import expect = require("expect.js");
import { createClient, RedisClientType } from "redis";
import { Server, Socket } from "socket.io";
import { io as ioc, Socket as ClientSocket } from "socket.io-client";
import { createAdapter } from "@socket.io/redis-adapter";
import { createServer } from "http";
import { Emitter } from "..";
import type { AddressInfo } from "net";

const SOCKETS_COUNT = 3;

describe("emitter - custom parser", () => {
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
      adapter: createAdapter(pubClient, subClient, {
        parser: {
          decode(msg) {
            return JSON.parse(msg);
          },
          encode(msg) {
            return JSON.stringify(msg);
          },
        },
      }),
    });

    httpServer.listen(() => {
      port = (httpServer.address() as AddressInfo).port;
      clientSockets = [];
      for (let i = 0; i < SOCKETS_COUNT; i++) {
        clientSockets.push(ioc(`http://localhost:${port}`));
      }
    });

    serverSockets = [];

    emitter = new Emitter(pubClient, {
      parser: {
        encode(msg) {
          return JSON.stringify(msg);
        },
      },
    });

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
    emitter.emit("payload", 1, "2", [3]);

    clientSockets[0].on("payload", (a, b, c) => {
      expect(a).to.eql(1);
      expect(b).to.eql("2");
      expect(c).to.eql([3]);
      done();
    });
  });
});
