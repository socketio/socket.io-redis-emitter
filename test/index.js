var expect = require('expect.js');
var redis = require('redis');
var io = require('socket.io');
var ioc = require('socket.io-client');
var redisAdapter = require('socket.io-redis');
var http = require('http').Server;
var ioe = require('../');

function client(srv, nsp, opts){
  if ('object' == typeof nsp) {
    opts = nsp;
    nsp = null;
  }
  var addr = srv.address();
  if (!addr) addr = srv.listen().address();
  var url = 'ws://' + addr.address + ':' + addr.port + (nsp || '');
  return ioc(url, opts);
}

describe('emitter', function() {
  var srv;

  beforeEach(function() {
    var pub = redis.createClient();
    var sub = redis.createClient(null, null, {detect_buffers: true});
    srv = http();
    var sio = io(srv, {adapter: redisAdapter({pubClient: pub, subClient: sub})});

    srv.listen(function() {
      ['/', '/nsp'].forEach(function(nsp) {
        sio.of(nsp).on('connection', function(socket) {
          socket.on('broadcast event', function(payload) {
            socket.emit('broadcast event', payload);
          });
        });
      });
    });
  });

  it('should be able to emit messages to client', function(done) {
    var emitter = ioe({ host: 'localhost', port: '6379' });
    var cli = client(srv, { forceNew: true });
    cli.on('connect', function() {
      emitter.emit('broadcast event', 'broadacast payload');
    });

    cli.on('broadcast event', function(payload) {
      cli.close();
      done();
    });
  });

  it('should be able to emit message to namespace', function(done) {
    var cli = client(srv, '/nsp', { forceNew: true });
    cli.on('broadcast event', function(payload) {
      cli.close();
      done();
    });

    cli.on('connect', function() {
      var emitter = ioe({ host: 'localhost', port: '6379' });
      emitter.of('/nsp').broadcast.emit('broadcast event', 'broadcast payload');
    });
  });

  it('should not emit message to all namespaces', function(done) {
    var a = client(srv, '/nsp', { forceNew: true });
    var b;

    a.on('connect', function() {
      b = client(srv, { forceNew: true });
      b.on('broadcast event', function(payload) {
        expect().fail();
      });

      b.on('connect', function() {
        var emitter = ioe({ host: 'localhost', port: '6379' });
        emitter.of('/nsp').broadcast.emit('broadcast event', 'broadcast payload');
      });
    });

    a.on('broadcast event', function(payload) {
      setTimeout(done, 1000);
    });
  });
});
