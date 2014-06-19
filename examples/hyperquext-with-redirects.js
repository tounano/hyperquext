var hyperquext = require("../hyperquext");
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