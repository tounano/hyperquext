var hyperquext = require("../hyperquext");
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