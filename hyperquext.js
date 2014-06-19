var _ = require("underscore");
var dq = require("decorquest");
var createRequestProxy = require("./lib/request-proxy");
var basequest = dq.attachAuthorizationHeader(dq.disableGlobalAgent(dq.request));
var reemit = require("./lib/helpers").reemit;
var bindMethod = require("./lib/helpers").bindMethod;
var url = require("url");

module.exports = exported;

function exported(uri, opts, cb) {
  return hyperquext(uri, opts, cb);
}
exported = _.extend(exported,{
  hyperquext: hyperquext,
  "get": bindMethod("get", hyperquext),
  "put": bindMethod("put", hyperquext),
  "post": bindMethod("post", hyperquext),
  "delete": bindMethod("delete", hyperquext)
}, {
  helpers: require("./lib/helpers"),
  createRequestProxy: require("./lib/request-proxy"),
  decorators: {
    hyperquextDirect: require("./decorators/hyperquextdirect")
  }
});

function hyperquext(uri, opts, cb) {
  if (typeof uri === 'object') {
    cb = opts;
    opts = uri;
    uri = undefined;
  }
  if (typeof opts === 'function') {
    cb = opts;
    opts = undefined;
  }
  if (!opts) opts = {};
  if (uri !== undefined) opts.uri = uri;
  if (opts.uri !== undefined)
    opts = _.extend(opts, url.parse(opts.uri));
  else
    opts.uri = url.format(opts);

  var request = opts.basequest || basequest;

  var req = doRequest(opts, request);
  req.setCallback(cb);

  return req;
}

function doRequest(opts, request) {
  request = request || basequest;
  var req = createRequestProxy(opts);

  var method = req.reqopts.method;
  var isDuplex = !(method === 'GET' || method === 'DELETE'
    || method === 'HEAD');

  var closed = false;
  req.on("close", function () {closed=true});

  if (!isDuplex) { req.rs.writable = false; req.ws.writable = false; }

  process.nextTick( function () {

    var r;
    try {
      r = request(req.reqopts);
    } catch (err) {
      req.emit("error", err);
      return;
    }
    req.on("close", function () {
      r.destroy();
    })

    reemit(r, req, ["socket", "connect", "upgrade", "continue", "error"]);
    r.on("response", function (res) {
      res.request = _.extend(res.request || {}, _.clone(req.reqopts));
      req.emit("response", res);

      if (isDuplex) res.pipe(req.rs);
      else {
        res.on("data", function (buf) {req.rs.queue(buf)});
        res.on("end", function () {
          req.rs.queue(null); req.ws.queue(null); });
      }
    })

    process.nextTick( function () {
      req.emit("sent");
      if (isDuplex) {
        req.ws.pipe(r);
        req.ws.resume();
      }
      else r.end();
    })
  }.bind(this));

  return req;
}