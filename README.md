#hyperquext

Like `Hyperquest` with extensions. Make streaming HTTP requests.

##rant

You can read my rant in [decorquest](https://github.com/tounano/decorquest).

To sum stuff up, here are the main motives behind both hyperquext and [decorquest](https://github.com/tounano/decorquest):

1. I needed something that can handle scale.
2. I needed something that I can extend without changing it's code. (Open-closed principle)

*  **[request](https://github.com/mikeal/request)** - As substack shows in [hyperquest](https://github.com/substack/hyperquest),
`request` is slow. In addition to that, it's a really complicated codebase. It crashed my app because of the smallest error.
 It's error reporting is weak. And in the bottom line, big codebases are good for the average case, which is an http request
 here and there.
*  **[hyperquest](https://github.com/substack/hyperquest)** - Did a good job for me, until I wanted to perform an HTTPs request
over HTTP proxy. At first, I started hacking my way around, but then I decided that a new module should be written with
`hyperquest` as inspiration for simplicity and scalability, and my struggle with extending it as a goal.

And here comes `hyperquext` - hyperquest with extensions.

###What about decorquest?

[decorquest](https://github.com/tounano/decorquest) is another module I authored for HTTP requests. Hyperquext is another
layer on top of `decorquest`. hyperquext depends on `decorquest`.

##Usage

```js
var hyperquext = require("hyperquext");
```

###var req = hyperquext(uri, opts, cb)

Make an outgoing request.

Args:

*  `uri` - A URL for the request. (optional)
*  `opts` - Options (optional)
*  `cb` - Callback with response that gets `err` and `res` as args. (Optional)

Return value: This method returns a `RequestProxy` object. It's methods would be described bellow.

**Overloading:**

*  `hyperquext({uri: "http://some-url.com"})` - You can specify the URI as a `uri` property in options.
*  `hyperquext(url.parse("http://some-url.com"))` - opts can be an instance of the `url.parse` return value.

**Options:**

Basically, it depends on the extensions you use. Each extension might require additional options. However, here are
the basic options of hyperquext:

*  `uri` - (optional). You don't have to specify the Request URL as an argument, you can specify it as a `uri` option or as an
extension of the `url.parse` response object. In any case `url.parse` would be performed on the `uri` you provide, and would
be merged on to the `opts` object.
*  `method` - (optional). Default method is `GET`.
*  `headers` - (optional). The request headers you'd like to send. (Default: {}).
*  `basequest` - (optional). An instance of [decorquest](https://github.com/tounano/decorquest). (Default: `dq.attachAuthorizationHeader(dq.disableGlobalAgent(dq.request));`)

Additional options:

*  Any options that is accepted by `http.request` and `https.request` like `agent`. The options object will be modified by
extensions and passed down until it reaches `http.request` or `https.request`.
*  Any options that are used by the decorators of `decorquest` or `hyperquext`.

####additional methods

hyperquext has some more methods:

*  `hyperquext.get` - overrides the method to GET. All the args are the same.
*  `hyperquext.put` - overrides the method to PUT. All the args are the same.
*  `hyperquext.post` - overrides the method to POST. All the args are the same.
*  `hyperquext.delete` - overrides the method to DELETE. All the args are the same.

###RequestProxy

An instance of this class is returned by `hyperquext` on every request. This object is a duplex stream. You can stream
the response to a downstream.

Or stream additional data (like POST data) towards that stream.

The actual request would be performed on the next tick, so you can set some data outside of `opts` using it's methods.

RequestProxy is a wrapper for `ClientRequest` objects, which are the default return values of Node's `http.request()`.

####methods

*  `req.setHeader(key, value)` - set an outgoing header.
*  `req.setLocation(uri)` - change the uri.
*  `req.abort()` - abort the request and destroy it's related streams.
*  `req.setTimeout(timeout, [cb])` - Once a `ClientRequest` object is assigned clientRequest.setTimeout() will be called.
*  `req.setNoDelay([nodelay])` - Once a `ClientRequest` object is assigned clientRequest.setNoDelay() will be called.
*  `req.setSocketKeepAlive([enable],[initialDelay])` - Once a `ClientRequest` object is assigned clientRequest.setSocketKeepAlive() will be called.

####events

RequestProxy is a stream. It will have all the events that a stream would have. Such as `data`, `end` and `close`.

Additional events:

*  `request` - Each time a new request is being made, it will emit a `request` event with `ClientRequest` object as an argument.
Several requests can be made by decorators. For example in the case of following redirects, it will perform a new request on each redirect.
*  `finalRequest` - Once the final request has been performed, it will emit the `ClientRequest` object in a `finalRequest` event.
This `ClientRequest` object will be emitted twice. Once in the `request` event, and once in `finalRequest` event.
*  `response` - Will be emitted as in other request modules.

In addition to that, each decorator might introduce new events. For example, `hyperquextDirect` will emit `redirect` event on
every redirect.

####Response object

The response object that will be passed on a `response` event is the standard `response` object that is provided by Node,
with one addition.

It would have a new object called `request` binded to it at `res.request`. `res.request` would be a simple DTO which will have
all the opts that the request was performed with and some other additions added by decorators.

For example, the `follow redirects` decorator would bind a `redirects` object to it, that will summerize all the redirects
that were followed.

The `respones` object would be added to the `RequestProxy` object once the response is ready, and it would be accessible
through `req.res`.

###Examples

####Perform many requests

This example was borrowed from [hyperquest](https://github.com/substack/hyperquest).

```js
/*
  This example was borrowed from `hyperquest` module.
 */

var http = require('http');
var hyperquext = require('hyperquext');

var server = http.createServer(function (req, res) {
  res.write(req.url.slice(1) + '\n');
  setTimeout(res.end.bind(res), 3000);
});

server.listen(5000, function () {
  var pending = 20;
  for (var i = 0; i < 20; i++) {
    var r = hyperquext('http://localhost:5000/' + i);
    r.pipe(process.stdout, { end: false });
    r.on('end', function () {
      if (--pending === 0) server.close();
    });
  }
});

process.stdout.setMaxListeners(0); // turn off annoying warnings
```

###Extending hyperquext using decorquest decorators

In this example, we'll extend `hyperquext` with [decorquest](https://github.com/tounano/decorquest) decorators. We'll
add a simple http proxy support.

```js
var hyperquext = require("hyperquext");
var dq = require("decorquest");

// Create a basequest object using `decorquest`
// Mind the `proxyquest` decoration.
var basequest = dq.proxyquest(dq.attachAuthorizationHeader(dq.disableGlobalAgent(dq.request)));

// We're injecting basequest to hyperquest.
// And setting a proxy as we would do in `decorquest`. In that case I use my Fiddler proxy.
var r = hyperquext("http://www.google.com", {maxRedirects: 5, proxy: "http://127.0.0.1:8888", basequest: basequest});

r.pipe(process.stdout);

r.on("response", function (res) {
  // Delay it for 3 seconds, so that r.pipe(process.stdout); will complete. Not necessary.
  // So that stuff won't mess up in console.
  setTimeout( function () {
    console.log(res.request);
  }, 3000);
});
```

##Decorators

`hyperquext` supports two types of decorators. Low-level decorators, that are provided by `decorquest` and High-level
decorators that decorate `hyperquext` directly and return a `RequestProxy` object.

###Usage
```js
var hyperquext = require("hyperquext");
var hyperquextDecorator = require("some-hyperquext-decorator");
var request = hyperquextDecorator(hyperquext);

var req = request("http://www.google.com");
```

###hyperquextDirect

As of today, the only decorator that comes out of the box is `hyperquextDirect`. This decorator will follow 3XX redirects
on `GET` requests.

This decorator will work, only if you pass a `maxRedirects` option. If this option is not present, it will send the request
as is.

####Events

`hyperquextDirect` will emit the `redirect` event on every redirect. The argument would be a `response` object of the redirect.

####Response

`hyperquextDirect` will add an array of redirects to `res.request.redirects`.

####Usage

```js
var hyperquext = require("hyperquext");
var hyperquextDirect = hyperquext.decorators.hyperquextDirect;

// Let's decorate hyperquext
var request = hyperquextDirect(hyperquext);

// http://google.com should redirect to http://www.google.com
var r = request("http://google.com", {maxRedirects: 5});
```

####Examples

**Simple redirects example**

```js
var hyperquext = require("hyperquext");
var hyperquextDirect = hyperquext.decorators.hyperquextDirect;

// Let's decorate hyperquext
var request = hyperquextDirect(hyperquext);

// http://google.com should redirect to http://www.google.com
var r = request("http://google.com", {maxRedirects: 5});

r.pipe(process.stdout);

// Redirect events
r.on("redirect", function (res) {
  // Delay it for 2 seconds, so that r.pipe(process.stdout); will complete. Not necessary.
  // So that stuff won't mess up in console
  setTimeout( function () {
    console.log("\n\nredirected\n\n");
  }, 2000)
})

r.on("response", function (res) {
  // Delay it for 3 seconds, so that r.pipe(process.stdout); will complete. Not necessary.
  // So that stuff won't mess up in console.
  setTimeout( function () {
    console.log(res.request);
  }, 3000);
});
```

**Using both High-level and Low-level decorators**

Let's take the example from before where we use a `proxyquest` decorator from `decorquest` module and combine it with
`hyperquextDirect`.

```js
var hyperquext = require("hyperquext");
var hyperquextDirect = hyperquext.decorators.hyperquextDirect;
var dq = require("decorquest");

// Create a basequest object using `decorquest`
// Mind the `proxyquest` decoration.
var basequest = dq.proxyquest(dq.attachAuthorizationHeader(dq.disableGlobalAgent(dq.request)));

// Decorate hyperquext
var request = hyperquextDirect(hyperquext);

// http://google.com should redirect to http://www.google.com
// We're injecting basequest to hyperquest.
// And setting a proxy as we would do in `decorquest`. In that case I use my Fiddler proxy.
var r = request("http://google.com", {maxRedirects: 5, proxy: "http://127.0.0.1:8888", basequest: basequest});

r.pipe(process.stdout);

// Redirect events
r.on("redirect", function (res) {
  // Delay it for 2 seconds, so that r.pipe(process.stdout); will complete. Not necessary.
  // So that stuff won't mess up in console
  setTimeout( function () {
    console.log("\n\nredirected\n\n");
  }, 2000)
})

r.on("response", function (res) {
  // Delay it for 3 seconds, so that r.pipe(process.stdout); will complete. Not necessary.
  // So that stuff won't mess up in console.
  setTimeout( function () {
    console.log(res.request);
  }, 3000);
});
```

##Developing decorators

In order to develop your own extensions for `hyperquext` first you need to decide if you're going to develop Low-level or
High-level decorators.

As a rule of thumb, Low-level (`decorquest`) decorators should be preffered. Please look at the documentation of [decorquest](https://github.com/tounano/decorquest)
to see how it should be done.

The only case when you should prefer developing a High-level decorator is when the success of the request depends on the response,
such as the case of handling `3XX redirects` or introducing a feature where you retry the request if it fails.

###API

####hyperquext.createRequestProxy()

This method would create a `RequestProxy` object that you can return immediately to the user.

####Events you must emit

*  `request` - Each time you make a sequential request, you have to emit the `ClientRequest` object as soon as possible.
You emit this object, before anything else you do. Emitting this object, as soon as possible will ensure safe cleanup, along
with proper functioning upon termination.
*  `finalRequest` - You must emit a `ClienRequest` object, once you that you won't have any sequential requests.

####hyperquext.helpers.bindMethod(method, hyperquext)

A helper method that helps creating `get`, `put`, `post`, `delete` methods to the decorators.

**Example:**

```js
var hyperquext = require("hyperquext");

function passthroughDecorator(hyperquext) {
  function decorator (uri, opts, cb) {
    var proxy = hyperquext.createProxy();
    // Just call hyperquext
    var hq = hyperquext(uri, opts, cb);

    hq.on('request', function (clientRequest) {proxy.emit('request', clientRequest);});
    hq.on('finalRequest', function (clientRequest) {proxy.emit('finalRequest', clientRequest);});

    return proxy;
  }

  decorator["get"] = bindMethod("GET", decorator);
  decorator["put"] = bindMethod("PUT", decorator);
  decorator["post"] = bindMethod("POST", decorator);
  decorator["delete"] = bindMethod("DELETE", decorator);

  return decorator;
}
```

##Final words

This module is under heavy development, and my hope is that other devs would be able to join this project and together
we'll create the best `web scraping` platform out there.

Special thanks to [substack](https://github.com/substack) for the big inspiration from his [hyperquest](https://github.com/substack/hyperquest)
module. If you don't need those fancy decorations it would be a better idea to use [hyperquest](https://github.com/substack/hyperquest).

##Important Note

Please follow [hyperquext](https://github.com/tounano/hyperquext) on github to get notified on API changes.

In any case, make sure to specify a version in `package.json`, so that if an API change were introduced your app won't
collapse.

The following practice is highly recommended:

```
...
  depndencies: [
    "hyperquext": "0.1.*"
  ]
...
```

##Changelog

*  `v0.1.0` - Hyperquext was rewritten and it changed it's architecture completely. Lot's of the logic moved to
 `RequestProxy` object, and from now on it won't reemit events from `ClientRequest` objects. Unless those events
 are request oriented like `response` or `error`.

## install

With [npm](https://npmjs.org) do:

```
npm install hyperquext@0.1.*
```

## license

MIT