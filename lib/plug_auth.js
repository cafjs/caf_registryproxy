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

"use strict";

/**
 * Security plug for proxy authentication/authorization.
 *
 * It should be named 'auth' in proxy.json
 *
 * @name caf_registryproxy/plug_auth
 * @namespace
 * @augments gen_plug
 *
 */
var assert = require('assert');
var path = require('path');
var fs = require('fs');
var caf_core =  require('caf_core');
var caf_comp = caf_core.caf_components;
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var caf_security = caf_core.caf_security;
var tokens = caf_security.tokens;
var json_rpc = caf_core.caf_transport.json_rpc;
var srpClient = require('caf_srp').client;
var cli = caf_core.caf_cli;

var BYPASS_ACTIONS = {'GET': true, 'INDEX': true, 'HEAD': true};

var RESTRICTED_ACTIONS = {'PUT': true, 'POST': true, 'DELETE': true,
                          'PATCH': true};


var TOKEN_CA_LOCAL_NAME = 'NEVERMIND';

var TOKEN_DURATION =1000000;

var DEFAULT_APP_LOCAL_NAME = 'nevermindAppLocalName';

var DEFAULT_APP_PUBLISHER = 'nevermindPublisher';

/**
 * Factory method to create a security plug.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {

    try {
        var cache = {};

        var that = genPlug.constructor($, spec);

        $._.$.log && $._.$.log.debug('New auth plug');

        var keysDir = spec.env.keysDir || $.loader.__ca_firstModulePath__();

        var loadKey = function(fileName) {
            if (fileName) {
                return fs.readFileSync(path.resolve(keysDir, fileName));
            } else {
                return null;
            }
        };

        var trustedPubKeyFile =  spec.env.trustedPubKeyFile;
        assert.equal(typeof spec.env.trustedPubKeyFile, 'string',
                     "'spec.env.trustedPubKeyFile' is not a string");
        var trustedPubKey = loadKey(trustedPubKeyFile);
        assert(trustedPubKey, 'Cannot load trusted pub key' +
               trustedPubKeyFile);

        assert.equal(typeof spec.env.accountsURL, 'string',
                     "'spec.env.accountsURL' is not a string");
        var accountsURL = spec.env.accountsURL;

        var checkPassword = function(application, userInfo, cb0) {
            try {
                var spec = {
                    log: function(x) { $._.$.log && $._.$.log.debug(x);},
                    securityClient: srpClient,
                    accountsURL: accountsURL,
                    password: userInfo.password,
                    from: json_rpc.joinName(userInfo.user, TOKEN_CA_LOCAL_NAME),
                    durationInSec: TOKEN_DURATION,
                    appLocalName : application.appLocalName ||
                        DEFAULT_APP_LOCAL_NAME,
                    appPublisher : application.appPublisher ||
                        DEFAULT_APP_PUBLISHER,
                    unrestrictedToken: false
                };

                var tf = cli.TokenFactory(spec);
                tf.newToken(null, function(err, data) {
                    if (err) {
                        cb0(err);
                    } else {
                        try {
                            tokens.validate(data, trustedPubKey);
                            // constraints already matched by TokenFactory
                            cb0(null, true);
                        } catch(error) {
                            $._.$.log &&
                                $._.$.log.debug(myUtils.errToPrettyStr(error));
                            cb0(error);
                        }
                    }
                });
            } catch(ex) {
                $._.$.log && $._.$.log.debug(myUtils.errToPrettyStr(ex));
                cb0(ex);
            }
        };

        var queue = async.queue(function(req, cb1) {
            var id = req.userInfo.user + ':' + req.userInfo.password;
            var cached = cache[id];
            if (typeof cached === 'boolean') {
                // set by a previous request in the queue
                cb1(null, cached);
            } else {
                checkPassword(req.application, req.userInfo, cb1);
            }
        }, 1); // sequential


        /**
         *  Authentication/authorization combined check.
         *
         * type of caf.appType is {appPublisher: string, appLocalName: string}
         * type of caf.userInfoType is {user:string, password: string}
         *
         * The enforced policy is that read-only operations can be performed
         * by any authenticated user, but write operations can only be done
         * by owners, i.e., (application.appPublisher === userInfo.user)
         *
         *
         * @param {string} action An http method.
         * @param {caf.appType} application The parsed image name.
         * @param {caf.userInfoType} userInfo Authentication user credentials.
         * @param {caf.cb} cb0 A callback with two arguments to return an error
         *  or whether it is allowed. An error should also deny the operation
         *  but is treated differently for caching purposes.
         *
         */
        that.checkAction = function(action, application, userInfo, cb0) {
            var checkAutho =  function(cb1) {
                if (BYPASS_ACTIONS[action]) {
                    cb1(null, true);
                } else if (RESTRICTED_ACTIONS[action]) {
                    if (application.appPublisher === userInfo.user) {
                        cb1(null, true);
                    } else {
                        var err = new Error('Only owners can modify images');
                        err.appPublisher = application.appPublisher;
                        err.user = userInfo.user;
                        cb1(err);
                    }
                } else {
                    var error = new Error('Invalid http method');
                    error.action = action;
                    cb1(error);
                }
            };

            var id = userInfo.user + ':' + userInfo.password;
            var cached = cache[id];
            if (cached) {
                checkAutho(cb0);
            } else if (typeof cached === 'boolean') {
                cb0(null, false);
            } else {
                //checkPassword serialized
                queue.push({application: application, userInfo: userInfo},
                           function(err, res) {
                               if (err) {
                                   cb0(err);
                               } else {
                                   cache[id] = (res ? true : false);
                                   checkAutho(cb0);
                               }
                           });
            };
        };

        that.clearCache = function(cb0) {
            cache = {};
            cb0(null);
        };

        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
