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

      proxy.on("redirect", onRedirect);
      proxy.on("close", function () {proxy.removeListener("redirect", onRedirect);});

      function onRedirect (res) {
        redirects.push({
          statusCode: res.statusCode,
          redirectUri: res.headers.location
        });
      }
      var failed = false;
      keepRequesting(hyperquext, req, opts.maxRedirects, function (err, req) {
        if (failed) return;
        if (err) {
          failed = true;
          err.reqopts = _.clone(proxy.reqopts);
          err.redirects = redirects;
          proxy.emit("error", err);

          return;
        }

        if (req.finalRequest) {
          emitFinalRequest(req.finalRequest);
        } else {
          req.once('finalRequest', function (finalRequest) {
            emitFinalRequest(finalRequest);
          });
        }

        function emitFinalRequest(finalRequest) {
          if (finalRequest.res) {
            attachRedirectsToResponse(finalRequest.res);
          } else {
            finalRequest.once('response', function (res) {
              attachRedirectsToResponse(res);
            });
          }

          proxy.emit('finalRequest', finalRequest);
        }

        function attachRedirectsToResponse(res) {
          res.request = res.request || {};
          res.request.redirects = res.request.redirects || [];
          res.request.redirects = _.union(res.request.redirects, redirects);
        }
      });


      return proxy;
    }

    function keepRequesting(hyperquext, initialRequest, maxRedirects, cb) {
      initialRequest.on('error', function requestErrorListener(err) {
        return cb(err, initialRequest);
      });
      initialRequest.on('request', function (request) {
        proxy.emit('request', request);
      });
      if (maxRedirects <= 0) { return cb(new Error('max redirects'), initialRequest); };

      initialRequest.on("response", function (res) {
        if (!(isRedirect(res.statusCode))) {
          cb(null, initialRequest);
        } else {
          proxy.emit("redirect", res);

          var opts = _.clone(initialRequest.reqopts);
          opts = _.extend(opts, url.parse(res.headers.location));
          opts.uri = res.headers.location;

          var req = hyperquext(opts);

          keepRequesting(hyperquext, req, --maxRedirects, cb);
        }
      });
    }
  }

  function isRedirect(statusCode) {
    statusCode = parseInt(statusCode);
    return (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308);
  }
}