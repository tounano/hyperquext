/*
 This example was borrowed from `hyperquest` module.
 */

var http = require('http');
var hyperquext = require('../hyperquext');

var server = http.createServer(function (req, res) {
  res.write(req.url.slice(1) + '\n');
  setTimeout(res.end.bind(res), 3000);
});

server.listen(5000, function () {
  var pending = 20;
  for (var i = 0; i < 20; i++) {
    var r = hyperquext.get('http://localhost:5000/' + i); // Requesting get method here...
    r.pipe(process.stdout, { end: false });
    r.on('end', function () {
      if (--pending === 0) server.close();
    });
  }
});

process.stdout.setMaxListeners(0); // turn off annoying warnings