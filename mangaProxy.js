var http = require('http'),
    httpProxy = require('http-proxy'),
    argv = require('optimist').argv,
    sites = require('./sites')

var host = argv.h || argv.host || '0.0.0.0'
var port = argv.p || argv.port || 80
var target = argv.t || argv.target || 'www.mangabull.com'
var debug = argv.d || argv.debug || false

var proxy = httpProxy.createProxyServer({
    target: 'http://' + target
})

proxy.on('proxyReq', function(proxyReq, req, res, options) {
    var _writeHead = res.writeHead
    var _write = res.write
    res.isText = false

    res.writeHead = function(code, headers) {
        var contentType = this.getHeader('content-type')
        if ((typeof contentType != 'undefined') && (contentType.indexOf('text/') == 0)) {
            res.isText = true
            res.datas = []
            res.removeHeader('Content-Length')
            if (headers) {
                delete headers['content-length']
            }
        }

        _writeHead.apply(res, arguments)
    }

    res.write = function(data, encoding) {
        if (res.isText) {
            res.datas.push(data.toString())
        }
        else {
            _write.apply(res, arguments)
        }
    }

    proxyReq.setHeader('host', target)
    req.startTime = new Date    
})

proxy.on('end', function(req, res, proxyRes) {
    if (res.isText) {
        var data = res.datas.join('')
        var isText = !!proxyRes.headers['content-type'] && /^text\//.test(proxyRes.headers['content-type'])
        if (isText) {
            data = data.split(target).join(req.headers.host)        
        }

        res.end(data)
    }

    if (!!debug) {
        console.log("http://%s%s time:%s isText:%s", req.headers.host, req.url, new Date-req.startTime, isText)
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
