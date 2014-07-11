var _ = require("underscore");
var url = require("url");
var createRequestProxy = require("../lib/request-proxy");
var redirector = require('./devcorators').redirector;
var parseArgs = require('./devcorators').parseArgs;
var getFinalRequestFromHyperquext = require('../lib/helpers').getFinalRequestFromHyperquext;
var getResponseFromClientRequest = require('../lib/helpers').getResponseFromClientRequest;

module.exports = hyperquextDirect;

function hyperquextDirect(hyperquext) {
  return redirector(parseArgs(function (uri, opts, cb) {
    var req = hyperquext(uri, opts, cb);
    if (req.reqopts.method !== 'GET' || !(opts.maxRedirects)) return req;

    getFinalRequestFromHyperquext(req, function (err, finalRequest) {
      getResponseFromClientRequest(finalRequest, function (err, res) {
        if (parseInt(res.statusCode) >= 300 && parseInt(res.statusCode) < 400) {
          finalRequest.res['$redirect'] = {
            statusCode: res.statusCode,
            redirectUri: url.resolve(opts.uri, res.headers.location)
          }
        }
      })
    })

    return req;
  }));
}