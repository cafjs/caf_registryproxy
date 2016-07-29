/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

/**
 * Network proxy for a Docker registry.
 *
 * @name caf_registryproxy/plug_registryproxy
 * @namespace
 * @augments gen_plug
 *
 */
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var caf_core = require('caf_core');
var caf_comp = caf_core.caf_components;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var https = require('https');
var httpProxy = require('http-proxy');
var urlParser = require('url');
var json_rpc = caf_core.caf_transport.json_rpc;

/**
 * Factory method to create a network proxy plug.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {

    try {
        var that = genPlug.constructor($, spec);

        $._.$.log && $._.$.log.debug('New registry proxy plug');

        var keysDir = spec.env.sslKeysDir || $.loader.__ca_firstModulePath__();

        var timeout = spec.env.proxyTimeoutMsec;

        var loadFile = function(fileName) {
            try {
                if (fileName) {
                    return fs.readFileSync(path.resolve(keysDir, fileName));
                } else {
                    return null;
                }
            } catch (ex) {
                return null;
            }
        };

        // port > 0
        var port = ($._.$.paas && $._.$.paas.getAppInternalPort()) ||
                spec.env.port;

        assert.equal(typeof port, 'number', 'Port is not a number');

        var target = spec.env.targetURL;
        assert.equal(typeof target, 'string', 'TargetURL is not a string');

        var sslPrivKeyFile = spec.env.sslPrivKeyFile;
        var sslCertFile = spec.env.sslCertFile;

        var sslKey = loadFile(sslPrivKeyFile);
        var sslCert = loadFile(sslCertFile);
        var pfx = loadFile(spec.env.pfxFile);

        var serverOptions = {};
        if (sslKey && sslCert) {
            serverOptions = {
                key: sslKey,
                cert: sslCert
            };
        } else if (pfx) {
            serverOptions = {
                pfx: pfx
            };
        } else {
            $._.$.log && $._.$.log.warn('Warning no SSL/TLS configured.');
        }


        var extractApp = function(reqUrl) {
            var pathName = urlParser.parse(reqUrl).pathname;
            var split = pathName.split('/');
            assert(split.length > 2, 'Invalid path ' + pathName);
            assert(split[1] === 'v2', 'Not supported version ' + split[1]);
            try {
                var noVersion = split[2].split(':')[0];
                var splitApp = json_rpc.splitName(noVersion);
                assert.equal(splitApp.length, 2, 'Invalid application name' +
                             noVersion);
                return {appPublisher: splitApp[0], appLocalName: splitApp[1]};
            } catch (ex) {
                $._.$.log && $._.$.log.trace('Invalid application name:' +
                                              split[2]);
                return {appPublisher: null, appLocalName: null};
            }
        };

        var extractUserInfo = function(headers) {
            var auth = headers.authorization;
            assert(typeof auth === 'string', 'Invalid Authorization in header');
            auth = auth.trim();
            var split = auth.split('Basic ');
            assert.equal(split.length, 2, 'bad password format' +
                         JSON.stringify(split));
            var buf = new Buffer(split[1], 'base64');
            var bufStr = buf.toString('utf8');
            var bufSplit = bufStr.split(':');
            assert(bufSplit.length >= 2, 'Invalid password ' + bufStr);
            var user = bufSplit[0];
            var password = bufSplit.slice(1).join(':');
            return {user: user, password: password};
        };

        var proxy = httpProxy.createProxyServer({timeout: timeout,
                                                 proxyTimeout: timeout});

        var server = https.createServer(serverOptions, function (req, res) {
            var sorry = function(err, data) {
                $._.$.log && $._.$.log.trace('server auth error:' +
                                             myUtils.errToPrettyStr(err || {}) +
                                             ' data: ' + data + 'url: ' +
                                             req.url + ' headers: ' +
                                             JSON.stringify(req.headers));

                res.writeHead(401, {
                    'Content-Type': 'application/json',
                    'Docker-Distribution-Api-Version': 'registry/2.0',
                    'WWW-Authenticate': 'Basic realm="Registry Authentication"'
                });
                var errData = {
                    'errors': [
                        {
                            'code': 401,
                            'message': 'Read only repo for non-owners',
                            'detail': 'Name your repos using the convention '
                                + 'registry.cafjs.com/<yourusername>-<whatever>'
                        }
                    ]
                };
                res.end(JSON.stringify(errData));
            };

            try {
                var action = req.method.toUpperCase().trim();
                var application = extractApp(req.url);
                var userInfo = extractUserInfo(req.headers);
                var traceOK = function() {
                    $._.$.log && $._.$.log.trace('RequestOK:' +
                                                 JSON.stringify(req.headers));
                };
                var traceError = function(err) {
                    $._.$.log && $._.$.log.trace('Connection error' +
                                                 myUtils.errToPrettyStr(err));
                };
                $._.$.auth.checkAction(action, application, userInfo,
                                       function(err, data) {
                                           if (err || !data) {
                                               sorry(err, data);
                                           } else {
                                               traceOK();
                                               proxy.web(req, res, {
                                                   target: target
                                               }, function(error) {
                                                   if (error) {
                                                       traceError(error);
                                                   }
                                               });
                                           }
                                       });
            } catch (error) {
                sorry(error);
            }
        }).listen(port);


        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            proxy && proxy.close();
            server && server.close();
            super__ca_shutdown__(data, cb0);
        };

        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
