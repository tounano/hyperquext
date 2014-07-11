var _ = require("underscore");
var url = require("url");

module.exports = {
  reemit: reemit,
  bindAbstract: bindAbstract,
  bindMethod: bindMethod,
  getResponseFromClientRequest: getResponseFromClientRequest,
  getFinalRequestFromHyperquext: getFinalRequestFromHyperquext
}

function getResponseFromClientRequest(clientRequest, cb) {
  if (clientRequest.res) return cb(null, clientRequest.res);
  clientRequest.once('response', function (res) {
    cb(null, res);
  });
}

function getFinalRequestFromHyperquext(proxy, cb) {
  if (proxy.finalRequest) return cb(null, proxy.finalRequest);
  proxy.once('finalRequest', function (finalRequest) {
    cb(null, finalRequest);
  });
}

function reemit(source, dest, events) {
  var listeners = [];

  _.each(events, function (event) {
    var listener = function () {
      var args = [].slice.call(arguments);
      args.unshift(event);
      dest.emit.apply(dest, args);
    }

    source.on(event, listener);

    listeners.push([event, listener]);
  })

  source.on("close", function () {
    process.nextTick( function () {
      _.each(listeners, function (val) {
        source.removeListener(val[0], val[1]);
      });

      listeners = [];
    })
  });
}

function bindAbstract(context, abstract) {
  _.each(abstract, function (val, key) {
    context[key] = val.bind(context);
  })

  return context;
}

function bindMethod(method, hyperquext) {
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
    opts.method = method.toUpperCase();

    return hyperquext(opts, cb);
  }
}