var _ = require("underscore");
var through = require("through");
var duplex = require("duplexer");
var bindAbstract = require("./helpers").bindAbstract;
var url = require("url");


module.exports = createRequestProxy;

function createRequestProxy(opts, cb) {
  opts.method = (opts.method || 'GET').toUpperCase();
  var isDuplex = !(opts.method === 'GET' || opts.method === 'DELETE'
    || opts.method === 'HEAD');

  var ws = through();
  var rs = through();
  var dup = isDuplex ? duplex(ws, rs) : rs;
  dup.isDuplex = isDuplex;

  dup.reqopts = opts || {};
  dup.ws = ws.pause();
  dup.rs = rs;
  dup.requests = [];

  if (!dup.isDuplex) rs.writeable = false;

  dup.on("request", onRequest.bind(dup));

  function onRequest(request) {
    this._sent = true;
    this.requests.push(request);

    request.on('error', requestErrorListener);
  }

  function requestErrorListener(err) {
    if (!dup._hadError) {
      dup._hadError = true;
      dup.emit('error', err);
    }
  }

  dup.once('error', function ensureSingleError() {
    dup._hadError = true;
    dup.abort();
  });

  dup.once("finalRequest", function (request) {
    dup.finalRequest = request;
    if (dup.isDuplex) { dup.ws.pipe(request); dup.ws.resume() }

    if (request.res) {
      pipeResponse(request.res);
      return this.emit('response', request.res);
    }

    request.once('response', finalRequestResponseListener);
  });

  function finalRequestResponseListener(res) {
    pipeResponse(res);
    dup.emit('response', res);
  }

  function pipeResponse(res) {
    res.request = res.request || {};
    res.request = _.extend(res.request, dup.reqopts);

    if (dup.isDuplex)
      return res.pipe(dup.rs);

    res.on('data', function (data) {
      dup.rs.queue(data);
    });

    res.on('end', function () {
      dup.rs.queue(null);
    });
  }

  dup.once("response",  function (res) {
    dup.res = res;
  });

  var originalDestroy = dup.destroy;
  dup.destroy =  function () {
    if (this.isDuplex) this.ws.destroy();
    originalDestroy();
    this.destroy = originalDestroy;
  }.bind(dup);

  dup.once('close', function () {
    if (this.requests.length) {
      _.each(this.requests, function (request) {
        request.removeListener('response', finalRequestResponseListener);
        request.abort();
        request.removeListener('error', requestErrorListener);
      })
    };

    this.requests = [];

    process.nextTick( function () {
      dup.removeAllListeners('request');
      dup.removeAllListeners('finalRequest');
      dup.removeAllListeners('response');
    })
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
    var proxy = this;
    if (this.requests.length) {
      _.each(this.requests, function (request) {
        request.abort();
      });
    }

    this.on("request", function (request) {
      request.abort();
    });
    process.nextTick( function () {
      proxy.destroy();
    });
    return this;
  },
  setTimeout: function(timeout, cb) {
    if (this.requests.length) {
      _.each(this.requests, function (request) {
        request.setTimeout(timeout, cb);
      });
    }

    this.on("request", function (request) {
      request.setTimeout(timeout, cb);
    });
    return this;
  },
  setNoDelay: function (noDelay) {
    if (this.requests.length) {
      _.each(this.requests, function (request) {
        request.setNoDelay(noDelay);
      });
    }

    this.on("request", function (request) {
      request.setNoDelay(noDelay);
    });
    return this;
  },
  setSocketKeepAlive: function (enable, initialDelay) {
    if (this.requests.length) {
      _.each(this.requests, function (request) {
        request.setSocketKeepAlive(enable, initialDelay);
      });
    }

    this.on("request", function (request) {
      request.setSocketKeepAlive(enable, initialDelay);
    });
    return this;
  },
  setCallback: function (cb) {
    if (!_.isFunction(cb)) return this;

    this.callback = cb;

    this.once("response", function _callbackResponse(res) {
      cb(null, res);
    });

    this.on("error", function _callbackError(err) {
      cb(err);
    });

    return this;
  }
}