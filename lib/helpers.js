var _ = require("underscore");
var url = require("url");

module.exports = {
  reemit: reemit,
  bindAbstract: bindAbstract,
  bindMethod: bindMethod
}

function reemit(source, dest, events) {
  _.each(events, function (event) {
    source.on(event,  function () {
      var args = [].slice.call(arguments);
      args.unshift(event);
      dest.emit.apply(dest, args);
    });
  })
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