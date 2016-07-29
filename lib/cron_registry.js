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
 *
 *  A cron job that performs bookkeeping security tasks.
 *
 *
 * @name cron_registry
 * @namespace
 * @augments  caf_component/gen_cron
 */
var caf_core = require('caf_core');
var caf_comp = caf_core.caf_components;
var myUtils = caf_comp.myUtils;
var genCron = caf_comp.gen_cron;


/**
 * Factory method to create a security cron job.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {

    try {
        var that = genCron.constructor($, spec);

        // this function is bound as a method of 'that'
        var securityF = function() {
            $._.$.log &&
                $._.$.log.debug('Cron ' + spec.name + ' waking up');
            var cb0 = function(err) {
                if (err) {
                    $._.$.log && $._.$.log.debug('pulser_cron ' +
                                         myUtils.errToPrettyStr(err));
                } else {
                    $._.$.log && $._.$.log.debug('security pulsing done.');
                }
            };
            $._.$.auth && $._.$.auth.clearCache(cb0);
        };
        that.__ca_start__(securityF);

        $._.$.log && $._.$.log.debug('New registry cron job');
        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
