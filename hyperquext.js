var _ = require("underscore");
var dq = require("decorquest");
var basequest = dq.attachAuthorizationHeader(dq.disableGlobalAgent(dq.request));
var createRequestProxy = require("./lib/request-proxy");
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
  },
  devcorators: require('./decorators/devcorators')
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

  process.nextTick( function () {
    var r;
    try {
      r = request(req.reqopts);
      req.emit('request', r);
      req.emit('finalRequest', r)

      // In case 2 errors would happen in a row
      r.on('error', function _doRequestOnError (err) {
        req.emit('error', err);
      });

      if (!req.isDuplex) r.end();

    } catch (err) {
      req.emit("error", err);
      return;
    }
  }.bind(this));

  return req;
}