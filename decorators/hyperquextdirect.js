var _ = require("underscore");
var url = require("url");
var createRequestProxy = require("../lib/request-proxy");
var reemit = require("../lib/helpers").reemit;

module.exports = hyperquextDirect;

function hyperquextDirect(hyperquext) {
  return function(uri, opts, cb) {
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


    opts = _.clone(opts);

    var req = hyperquext(uri, opts);

    if (req.reqopts.method !== 'GET' || !opts.maxRedirects) {
      req.setCallback(cb);
      return req;
    } else {
      var proxy = createRequestProxy(opts, cb);

      var redirects = [];

      req.on("redirect", function (res) {
        redirects.push({
          statusCode: res.statusCode,
          redirectUri: res.headers.location
        });
      });

      reemit(req, proxy, ["socket", "connect", "upgrade", "continue", "redirect"]);

      keepRequesting(hyperquext, req, opts.maxRedirects, function (err, req) {
        if (err) {
          err.reqopts = _.clone(proxy.reqopts);
          err.redirects = redirects;
          proxy.emit("error", err);
          proxy.end();
          process.nextTick( function () {
            req.destroy();
          })

          return;
        }

        if (req.res) {
          req.res.request.redirects = redirects;
          proxy.emit("response", req.res);
        } else req.on("response", function (res) {
          req.res.request.redirects = redirects;
          proxy.emit("response", res);
        });

        req.on("data", function (buf) {proxy.rs.queue(buf)});
        req.on("end", function () {proxy.rs.queue(null);proxy.ws.queue(null);});
      });

      return proxy;
    }
  }

  function keepRequesting(hyperquext, initialRequest, maxRedirects, cb) {
    initialRequest.on("error", function(err) {cb(err, initialRequest)});
    if (maxRedirects <= 0) { return cb(null, initialRequest); }
    initialRequest.on("response", function (res) {
      if (!(isRedirect(res.statusCode))) {
        cb(null, initialRequest);
      } else {
        initialRequest.emit("redirect", res);
        var opts = _.clone(initialRequest.reqopts);
        opts = _.extend(opts, url.parse(res.headers.location));
        opts.uri = res.headers.location;

        var req = hyperquext(opts);
        req.rs.autoDestroy = false;
        req.on("redirect", function (res) {initialRequest.emit("redirect", res)});

        keepRequesting(hyperquext, req, --maxRedirects, cb);
      }
    });
  }

  function isRedirect(statusCode) {
    statusCode = parseInt(statusCode);
    return (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308);
  }
}