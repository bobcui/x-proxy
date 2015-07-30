var http = require('http'),
  httpProxy = require('http-proxy'),
  argv = require('optimist').argv

var host = argv.h || argv.host || '0.0.0.0'
var port = argv.p || argv.port || 80
var debug = argv.d || argv.debug || false
var configFile = argv.c || argv.config || './config.js'

var config = require(configFile)
var src = config.src
var sites = config.sites

var proxy = httpProxy.createProxyServer({
  target: 'http://' + src.domain
})

var getDestDomain = function(host) {
  return host
}

var getDestSiteName = function(host) {
  var hostParts = host.toLowerCase().split('.')
  var i = hostParts.length - 2
  if (i < 0) {
    i = 0
  }

  var domainParts = []
  for (; i<hostParts.length; ++i) {
    domainParts.push(hostParts[i])
  }

  return domainParts.join('.')
}

var purify = function(data, host) {
  var siteKey = getDestSiteName(host).split('.').join('_')
  var siteConfig = sites[siteKey] || {}
  siteConfig.domain = getDestDomain(host)
  siteConfig.siteName = getDestSiteName(host)

  for (var key in src) {
    data = data.split(src[key]).join(siteConfig[key])
  }
  return data
}

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  res.isText = false
  res.datas = []

  var _write = res.write
  res.write = function(data, encoding) {
    if (res.isText) {
      res.datas.push(data.toString())
    }
    else {
      _write.apply(res, arguments)
    }
  }

  proxyReq.setHeader('host', src.domain)
  req.startTime = new Date
})


proxy.on('proxyRes', function(proxyRes, req, res) {
  var destDomain = getDestDomain(req.headers.host)
  for (var key in proxyRes.headers) {
    proxyRes.headers[key] = proxyRes.headers[key].split(src.domain).join(destDomain)
  }

  var contentType = proxyRes.headers['content-type']
  if ((typeof contentType !== 'undefined') && (contentType.indexOf('text/') == 0)) {
    res.isText = true
    delete proxyRes.headers['content-type']
  }
})

proxy.on('end', function(req, res, proxyRes) {
  var dataLen = -1
  if (res.isText) {
    var data = res.datas.join('')
    data = purify(data, req.headers.host)
    res.end(data)
    dataLen = data.length
  }

  if (!!debug) {
    console.log("http://%s%s time:%d isText:%d length:%d", req.headers.host, req.url, new Date-req.startTime, res.isText, dataLen)
  }  
})

proxy.on('error', function (err, req, res) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  })
  res.end('Something went wrong. And we are reporting a custom error message.')
})

process.on('uncaughtException', function(err){
  console.error(err.stack)
})

console.log("listening on %s:%s", host, port)

http.createServer(function(req, res) {
  proxy.web(req, res)
}).listen(port, host)
