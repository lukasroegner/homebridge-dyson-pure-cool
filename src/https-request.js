const http = require('http');
const https = require('https');

/**
 * Performs an HTTP(S) request with the subset of the options of the deprecated "request" package that this plugin uses.
 * @param options The options: uri, method, headers, json (true to parse the response, or an object to send as JSON body) and rejectUnauthorized.
 * @param callback The callback, called with (error, response, body) like the "request" package.
 */
function httpsRequest(options, callback) {
    let done = false;
    const finish = function (error, response, body) {
        if (!done) {
            done = true;
            callback(error, response, body);
        }
    };

    let url;
    try {
        url = new URL(options.uri);
    } catch (error) {
        return finish(error);
    }

    // Sets the headers and the JSON body, if any
    const headers = Object.assign({}, options.headers);
    let payload = null;
    if (options.json) {
        headers['Accept'] = headers['Accept'] || 'application/json';
    }
    if (options.json && typeof options.json === 'object') {
        payload = JSON.stringify(options.json);
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const transport = url.protocol === 'http:' ? http : https;
    const req = transport.request(url, {
        method: options.method || 'GET',
        headers: headers,
        rejectUnauthorized: options.rejectUnauthorized !== false,
        timeout: options.timeout || 30000
    }, function (res) {
        const chunks = [];
        res.on('data', function (chunk) {
            chunks.push(chunk);
        });
        res.on('error', function (error) {
            finish(error);
        });
        res.on('end', function () {
            let body = Buffer.concat(chunks).toString('utf8');

            // Parses the body like the "request" package: only if JSON was requested, and only if it is valid JSON
            if (options.json && body.length > 0) {
                try {
                    body = JSON.parse(body);
                } catch (error) {
                    // Keeps the body as string
                }
            }
            finish(null, res, body);
        });
    });
    req.on('timeout', function () {
        req.destroy(new Error('Request timed out'));
    });
    req.on('error', function (error) {
        finish(error);
    });
    if (payload) {
        req.write(payload);
    }
    req.end();
}

module.exports = httpsRequest;
