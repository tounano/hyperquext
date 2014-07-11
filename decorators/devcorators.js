var url = require('url');
var getFinalRequestFromHyperquext = require('../lib/helpers').getFinalRequestFromHyperquext;
var getResponseFromClientRequest = require('../lib/helpers').getResponseFromClientRequest;
var hq = require('../');
var _ = require('underscore');

module.exports = {
  parseArgs: parseArgs,
  attachBodyToResponse: attachBodyToResponse,
  consumeForcedOption: consumeForcedOption,
  redirector: redirector
}

function redirector(hyperquext) {
  return parseArgs(function (uri, opts, cb) {
    var req = hyperquext(uri, opts);

    if (req.reqopts.method !== 'GET' || !(opts.maxRedirects)) {
      req.setCallback(cb);
      return req;
    }
    var proxy = hq.createRequestProxy(opts, cb);
    var redirects = [];
    proxy.on('redirect', onRedirect); function onRedirect(res) {redirects.push(res['$redirect'])};
    proxy.on('close', function () {proxy.removeAllListeners('redirect')});

    ;(function handleRedirects(req) {
      req.on('request', function (clientRequest) {proxy.emit('request', clientRequest)});
      req.on('error', function (err) {proxy.emit('error', err)});

      getFinalRequestFromHyperquext(req, function (err, finalRequest) {
        getResponseFromClientRequest(finalRequest, function (err, res) {
          if (res['$redirect']) {
            req.abort();
            req.destroy();
            var opts = _.extend({}, req.reqopts, {uri: res['$redirect'].redirectUri, maxRedirects: req.reqopts.maxRedirects-1});
            if (opts.maxRedirects <= 0){ return proxy.emit('error', _.extend(new Error('max redirects'), {reqopts: _.clone(proxy.reqopts), redirects: redirects}));}
            var redirecting = hyperquext(opts.uri, opts);
            proxy.emit('redirect', res);
            redirecting.on('redirect', onRedirect); function onRedirect(res) {proxy.emit('redirect',res)};
            redirecting.on('close', function () {redirecting.removeListener('redirect', onRedirect)});
            return handleRedirects(redirecting);
          }

          finalRequest.res.request.redirects = finalRequest.res.request.redirects || [];
          finalRequest.res.request.redirects = _.union(finalRequest.res.request.redirects, redirects);
          proxy.emit('finalRequest', finalRequest)
        })
      })

    })(req);

    return proxy;
  });
}

function parseArgs(hyperquext) {
  return function (uri, opts, cb) {
    if (uri && opts && cb) return hyperquext(uri, opts, cb);

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

    return hyperquext(opts.uri, opts, cb);
  }
}

function attachBodyToResponse(hyperquext) {
  return parseArgs(function (uri, opts, cb) {
    if (!opts.body) return hyperquext(uri, opts, cb);

    var proxy = hq.createRequestProxy(opts, cb);
    var req = hyperquext(uri, opts);


    req.on('request', function (request) {proxy.emit('request', request); } )
    req.on('error', function (err) {proxy.emit('error', err); } )

    getFinalRequestFromHyperquext(req, function (err, finalRequest) {
      getResponseFromClientRequest(finalRequest, function (err, res) {
        if (res.body) return;
        var stream = require('through')().pause();
        stream.body = '';

        res.on('data', function (d) {stream.body += d.toString('utf8'); stream.queue(d);});
        res.on('end', function () {
          finalRequest.res = _.extend({}, finalRequest.res, stream);
          proxy.emit('finalRequest', finalRequest);
          stream.queue(null);
          stream.resume();
        });
      })
    })

    return proxy;
  });
}

function consumeForcedOption(hyperquext, option) {
  return parseArgs(function (uri, opts, cb) {
    if (!option || opts[option]) return hyperquext(uri, opts, cb);
    var obj = {};
    obj[option] = true;
    var req = hyperquext(uri, _.extend(opts, obj), cb);
    getFinalRequestFromHyperquext(req, function (err, finalRequest) {
      getResponseFromClientRequest(finalRequest, function (err, res) {
        process.nextTick( function () {
          obj = {};
          delete opts[option];
          delete finalRequest.res[option];
        })
      })
    })
    return req;
  })
}