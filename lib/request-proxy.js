var _ = require("underscore");
var through = require("through");
var duplex = require("duplexer");
var bindAbstract = require("./helpers").bindAbstract;
var url = require("url");


module.exports = createRequestProxy;

function createRequestProxy(opts, cb) {
  var ws = through();
  var rs = through();
  var dup = duplex(ws, rs);
  dup.ws = ws.pause();
  dup.rs = rs;
  dup.reqopts = opts || {};

  dup.reqopts.method = (dup.reqopts.method || 'GET').toUpperCase();

  dup.once("sent", function () {
    dup._sent = true;
  })

  dup.once("response",  function (res) {
    dup.res = res;
  });

  dup = bindAbstract(dup, AbstrackRequestProxy);
  dup.setCallback(cb);

  return dup;
}

var AbstrackRequestProxy = {
  setLocation: function (uri) {
    if (this._sent) throw new Error('request already sent');
    this.reqopts = _.extend(this.reqopts, url.parse(uri));
    return this;
  },
  setHeader: function (key, value) {
    if (this._sent) throw new Error('request already sent');
    this.reqopts.headers = this.reqopts.headers || {};
    this.reqopts.headers[key] = value;
    return this;
  },
  abort: function() {
    this.once("socket", function (socket) {
      socket.destroy();
    });
    this.emit("close");
    return this;
  },
  setTimeout: function(timeout, cb) {
    this.once("socket", function (socket) {
      socket.setTimeout(timeout, cb);
    });
    return this;
  },
  setNoDelay: function (noDelay) {
    this.once("socket", function (socket) {
      socket.setNoDelay(noDelay);
    });
    return this;
  },
  setSocketKeepAlive: function (enable, initialDelay) {
    this.once("socket", function (socket) {
      socket.setSocketKeepAlive(enable, initialDelay);
    });
    return this;
  },
  setCallback: function (cb) {
    if (!_.isFunction(cb)) return this;
    this.callback = cb;

    this.once("response", function (res) {
      cb(null, res);
    });

    this.once("error", function (err) {
      cb(err);
    });

    return this;
  }
}