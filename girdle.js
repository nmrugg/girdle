// jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, onevar:true, strict:true, undef:true, unused:strict, curly:true, browser:true, evil:true

var G = (function ()
{
    "use strict";
    
    var G = {
        array_remove: function array_remove(arr, i, order_irrelevant)
        {
            var len = arr.length;
            
            /// Handle negative numbers.
            if (i < 0) {
                i = len + i;
            }
            
            /// If the last element is to be removed, then all we need to do is pop it off.
            ///NOTE: This is always the fastest method and it is orderly too.
            if (i === len - 1) {
                arr.pop();
            /// If the second to last element is to be removed, we can just pop off the last one and replace the second to last one with it.
            ///NOTE: This is always the fastest method and it is orderly too.
            } else if (i === len - 2) {
                arr[len - 2] = arr.pop();
            /// Can use we the faster (but unorderly) remove method?
            } else if (order_irrelevant || i === len - 2) {
                if (i >= 0 && i < len) {
                    /// This works by popping off the last array element and using that to replace the element to be removed.
                    arr[i] = arr.pop();
                }
            } else {
                /// The first element can be quickly shifted off.
                if (i === 0) {
                    arr.shift();
                /// Ignore numbers that are still negative.
                ///NOTE: By default, if a number is below the total array count (e.g., array_remove([0,1], -3)), splice() will remove the first element.
                ///      This behavior is undesirable because it is unexpected.
                } else if (i > 0) {
                    /// Use the orderly, but slower, splice method.
                    arr.splice(i, 1);
                }
            }
        },
        
        get_random_int: function get_random_int(min, max)
        {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        
        is_object: function is_object(mixed)
        {
            return typeof mixed === "object" && mixed !== null && !Array.isArray(mixed);
        },
        
        normalize_mouse_buttons: function normalize_mouse_buttons(e)
        {
            if (e) {
                if (typeof e.which !== "undefined") {
                    return e.which;
                }
                if (typeof e.button !== "undefined") {
                    if (e.button === 0) {
                        return 1;
                    } else if (e.button === 1) {
                        return 4;
                    } else {
                        return e.button;
                    }
                }
            }
        },
        
        /**
         * Safely parse JSON.
         */
        parse_json: function parse_json(str)
        {
            try {
                return JSON.parse(str);
            } catch (e) {}
        },
    };
    
    if (typeof window === "object") {
        if (typeof window.document === "object") {
            G.create_dom_el = function create_dom_el(type, properties, events, children)
            {
                var el = type === "documentFragment" ? document.createDocumentFragment() : document.createElement(type);
                
                if (typeof properties === "object" && properties instanceof Object) {
                    Object.keys(properties).forEach(function (prop)
                    {
                        if (prop === "list" || prop === "for" || prop.indexOf(":") > -1) {
                            el.setAttribute(prop, properties[prop]);
                        } else {
                            el[prop] = properties[prop];
                        }
                    });
                }
                
                if (typeof events === "object" && events instanceof Object) {
                    Object.keys(events).forEach(function (prop)
                    {
                        /// A psuedo event
                        if (prop === "all_on_changes") {
                            el.addEventListener("change", events[prop]);
                            el.addEventListener("keypress", events[prop]);
                            el.addEventListener("keyup", events[prop]);
                        } else {
                            el.addEventListener(prop, events[prop]);
                        }
                    });
                }
                
                if (Array.isArray(children)) {
                    children.forEach(function (child)
                    {
                        el.appendChild(child);
                    });
                }
                
                return el;
            };
            
            /// **************************
            /// * End of window.document *
            /// **************************
        }
        
        if (window.XMLHttpRequest) {
            /**
             * Create an easy to use Ajax object.
             *
             * @example var ajax = new Create_easy_ajax();
             * @return  Returns an object that makes ajax easier.
             */
            G.Create_easy_ajax = (function ()
            {
                /**
                 * Create the global_retry object and closure.
                 */
                var global_retry = (function ()
                {
                    var func_arr = [],
                        retrying  = false;
                    
                    /**
                     * Loop through all of the attached functions to retry the pending queries.
                     *
                     * @note All functions are run approximately the same time, regardless of when they were cued.
                     */
                    function retry()
                    {
                        var i;
                        
                        for (i = func_arr.length - 1; i >= 0; i -= 1) {
                            ///NOTE: The functions are executed via setTimeout to ensure that no other functions will get attached in the mean time.
                            window.setTimeout(func_arr[i], 0);
                        }
                        
                        /// After re-running all of the Ajax queries, clear the list.  If there is still a problem, they will get re-attached.
                        func_arr = [];
                        retrying  = false;
                    }
                    
                    return {
                        /**
                         * Attach a function to the retry cue.
                         *
                         * Also, set the retry timeout if is is not already pending.
                         *
                         * @param func (function) The function to add to the list of functions to run when retrying.
                         */
                        attach: function (func)
                        {
                            if (typeof func === "function") {
                                func_arr[func_arr.length] = func;
                                
                                if (!retrying) {
                                    ///TODO: Adjust the delay according to how many times the queries have failed and perhaps other factors (like connection quality and speed).
                                    window.setTimeout(retry, 1000);
                                    retrying = true;
                                }
                            }
                        },
                        /**
                         * Remove a function from the retry cue.
                         *
                         * @param func (function) The function to remove from the list of functions to run when retrying.
                         */
                        detach: function (func)
                        {
                            var i;
                            
                            for (i = func_arr.length - 1; i >= 0; i -= 1) {
                                if (func_arr[i] === func) {
                                    G.array_remove(func_arr, i);
                                    /// Since a function can (or at least should) only be cued once, it does not need to keep looping.
                                    return;
                                }
                            }
                        }
                    };
                }());
                
                /**
                 * Create the function that creates easy to use Ajax objects.
                 */
                return function Create_easy_ajax()
                {
                    var aborted,
                        ajax = new window.XMLHttpRequest(),
                        ajax_obj,
                        ajax_timeout,
                        retry_func,
                        retrying = false;
                    
                    ajax_obj = {
                        /**
                         * Stop the query if it is already in progress.
                         *
                         * Also, prevent it from retrying as well.
                         */
                        abort: function ()
                        {
                            /// If the query is waiting to be retried, it needs to be removed from the retrying cue.
                            if (retrying) {
                                retrying = false;
                                global_retry.detach(retry_func);
                            }
                            /// Is a query in progress?  If readyState > 0 and < 4, it needs to be aborted.
                            if (ajax.readyState % 4) {
                                /// Stop it from retrying from a timeout.
                                window.clearTimeout(ajax_timeout);
                                ajax.abort();
                                aborted = true;
                            }
                        },
                        /**
                         * Determines whether or not the Ajax object is busy preforming a query or waiting to retry a query.
                         */
                        is_busy: function ()
                        {
                            /// Even though the Ajax object is idle when retrying, it should still be considered busy since a query is still potentially coming.
                            ///NOTE: Any readyState not 0 or 4 is busy.
                            return retrying || Boolean(ajax.readyState % 4);
                        },
                        /**
                         * Create the closure to easily send Ajax queries to the server.
                         */
                        query: (function ()
                        {
                            /**
                             * Send the Ajax request and start timeout timer.
                             *
                             * @param  message (string)  The variables to send (URI format: "name1=value1&name2=value%202").
                             * @param  timeout (number)  How long to wait before giving up on the script to load (in milliseconds).
                             * @param  retry   (boolean) Whether or not to retry loading the script if a timeout occurs.
                             * @return NULL
                             * @note   This code is a separate function to reduce code duplication.
                             * @note   Called by the Create_easy_ajax.query().
                             */
                            function send_query(message, timeout, retry)
                            {
                                ajax.send(message);
                                
                                if (timeout) {
                                    /// Begin the timeout timer to ensure that the download does not freeze.
                                    ///NOTE: ajax_timeout is cleared if the query completes before the timeout is fired (successfully or unsuccessfully).
                                    ajax_timeout = window.setTimeout(function ()
                                    {
                                        ajax_obj.abort();
                                        ///TODO: If it should not retry, it should return undefined to the callback.
                                        if (retry) {
                                            retrying = true;
                                            ///NOTE: retry_func() was created in the query() function but initialized outside to give other functions access to it.
                                            global_retry.attach(retry_func);
                                        }
                                    }, timeout);
                                }
                            }
                            
                            /**
                             * Send an Ajax request to the server.
                             *
                             * @example .query("POST", "api", "q=search", function (data) {}, function (status, data) {}, 10000, true);
                             * @param   method    (string)              The HTTP method to use (GET || POST).
                             * @param   path      (string)              The URL to query.
                             * @param   message   (string)   (optional) The variables to send (URI format: "name1=value1&name2=value%202").
                             * @param   onsuccess (function) (optional) The function to run on a successful query.
                             * @param   onfailure (function) (optional) The function to run if the query fails.
                             * @param   timeout   (number)   (optional) How long to wait before giving up on the script to load (in milliseconds).
                             *                                          A falsey value (such as 0 or FALSE) disables timing out.         (Default is 30,000 milliseconds.)
                             * @param   retry     (boolean)  (optional) Whether or not to retry loading the script if a timeout occurs.  (Default is TRUE.)
                             * @return  NULL
                             * @todo    Determine if it should change a method from GET to POST if it exceeds 2,083 characters (IE's rather small limit).
                             */
                            return function query(method, path, message, onsuccess, onfailure, timeout, retry)
                            {
                                var post_message,
                                    failed;
                                
                                /// Because queries could be stored in the global_retry and run later, we need to make sure any cued queries are aborted.
                                ajax_obj.abort();
                                /// Reset the aborted variable because we are starting a new query.
                                aborted = false;
                                
                                /// Determine if arguments were passed to the last two parameters.  If not, set the defaults.
                                if (typeof timeout === "undefined") {
                                    /// Default to 30 seconds.
                                    ///TODO: This should be dynamic based on the quality of the connection to the server.
                                    timeout = 30000;
                                }
                                
                                if (typeof retry === "undefined") {
                                    /// Set retry to TRUE by default.
                                    retry = true;
                                }
                                
                                /**
                                 * A function that can be called to resend the query.
                                 *
                                 * @note This function gets sent to global_retry.attach() if there is an error and the query needs to be resent.
                                 * @note This must be created inside of query() but it is initiated outside so that it can be sent to global_retry.detach() if the query is aborted.
                                 * @note Currently, this function is never cleared even when it is no longer needed.
                                 */
                                retry_func = function ()
                                {
                                    /// Set retrying to FALSE tells the Ajax object not to consider the query busy anymore when idle.
                                    retrying = false;
                                    query(method, path, message, onsuccess, onfailure, timeout, retry);
                                };
                                
                                if (method.toLowerCase() === "get") {
                                    /// GET requests need the message appended to the path.
                                    ajax.open(method, path + (message ? "?" + message : ""));
                                } else {
                                    /// POST requests send the message later on (with .send()).
                                    ajax.open(method, path);
                                    post_message = message;
                                }
                                
                                /// Without the correct content-type, the data in the message will not become variables on the server.
                                ajax.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                                
                                /**
                                 * Handle Ajax failures.
                                 */
                                failed = function failed()
                                {
                                    if (onfailure) {
                                        onfailure(ajax.status, ajax.responseText);
                                    }
                                    
                                    /// Should it retry?
                                    ///NOTE: Since 400 errors indicate a problem with the client, most 400 errors should not be repeated.
                                    ///      Error 408 (Request Timeout) can be repeated by the client without modification.
                                    if (retry && !aborted) {
                                        retrying = true;
                                        global_retry.attach(retry_func);
                                    }
                                };
                                
                                ajax.onerror = failed;
                                
                                /**
                                 * Handle the request once it has been completed.
                                 */
                                ajax.onload = function onload()
                                {
                                    /// Stop the timeout timer that may be running so it does not try again.
                                    window.clearTimeout(ajax_timeout);
                                    
                                    /// HTTP status codes:
                                    /// 1xx Informational
                                    /// 2xx Success
                                    /// 3xx Redirection
                                    /// 4xx Client Error
                                    /// 5xx Server Error
                                    ///NOTE: If the status code is 0 that means that the server did not send back any response.
                                    
                                    /// Was the request successful?
                                    ///NOTE: It may be good to accept other 200 level codes.
                                    if (ajax.status === 200) {
                                        if (onsuccess) {
                                            ///NOTE: It is not parsed here because it may not be parsed at all.
                                            onsuccess(ajax.responseText);
                                        }
                                    } else {
                                        failed();
                                    }
                                };
                                send_query(post_message, timeout, retry);
                            };
                        }())
                    };
                    
                    return ajax_obj;
                };
            }());
            
            /**
             * Load some Javascript and optionally send it some variables from the closure.
             *
             * @example include("/path/to/script.js", {needed_var: var_from_the_closure}, 20000, false);
             * @param   path    (string)             The location of the JavaScript to load.
             * @param   context (object)             The variable to send to the included JavaScript.
             * @param   timeout (number)  (optional) How long to wait before giving up on the script to load (in milliseconds).
             *                                       A falsey value (such as 0 or FALSE) disables timing out.         (Default is 10,000 milliseconds.)
             * @param   retry   (boolean) (optional) Whether or not to retry loading the script if a timeout occurs.  (Default is TRUE.)
             * @return  NULL.  Executes code.
             * @todo    If the code has already been loaded, simply run the script without re-downloading anything.
             * @todo    Determine if it would be better to use a callback function rather than passing context.
             */
            G.include = (function ()
            {
                /// Store the "this" variable to let the other functions access it.
                var that = this;
                
                /**
                 * Eval code in a neutral scope.
                 *
                 * @param  code (string) The string to eval.
                 * @return The result of the eval'ed code.
                 * @note   Called when the Ajax request returns successfully.
                 * @note   This function is used to prevent included code from having access to the variables inside of the function's scope.
                 */
                this.evaler = function (code)
                {
                    ///NOTE: Since the eval'ed code has access to the variables in this closure, we need to clear out the code variable both as a security caution and
                    ///      to prevent memory leaks.  The following code does just that: (code = ""). However, this also messes up Firebug's debugger.
                    return eval(code + (code = ""));
                };
                
                /// Prevent any eval'ed code from being able to modify the evaler() function.
                Object.freeze(this);
                
                return function (path, context, callback, timeout, retry)
                {
                    (new G.Create_easy_ajax()).query("GET", path, "", function (response)
                    {
                        /// Evaluate the code in a safe environment.
                        /// Before evaluation, add the sourceURL so that debuggers can debug properly be matching the code to the correct file.
                        /// See https://blog.getfirebug.com/2009/08/11/give-your-eval-a-name-with-sourceurl/.
                        var res = that.evaler(response + "//@ sourceURL=" + path);
                        
                        /// If the eval'ed code is a function, send it the context.
                        if (typeof res === "function") {
                            res(context);
                        }
                        if (typeof callback === "function") {
                            callback();
                        }
                    }, null, timeout, retry);
                };
            ///NOTE: Since this anonymous function would have an undefined "this" variable, we need to use the call() function to specify an empty "this" object.
            ///      The "this" object is used to "secure" the code from the eval'ed code using Object.freeze().
            }).call({});
        }
        
        G.get_params = function get_params()
        {
            var sep1 = window.location.search.split(/\&|\?/g),
                sep2,
                params = {},
                i,
                len;
            
            len = sep1.length;
            
            if (len > 1) {
                for (i = 1; i < len; i += 1) {
                    sep2 = sep1[i].split(/=/);
                    sep2[0] = decodeURIComponent(sep2[0]);
                    if (sep2[1]) {
                        sep2[1] = decodeURIComponent(sep2[1]);
                    }
                    if (params[sep2[0]]) {
                        if (typeof params[sep2[0]] !== "object") {
                            params[sep2[0]] = [params[sep2[0]]];
                        }
                        params[sep2[0]].push(sep2[1]);
                    } else {
                        params[sep2[0]] = sep2[1];
                    }
                }
            }
            
            return params;
        }
    }
    
    G.events = (function ()
    {
        var func_list = {};
        
        return {
            /**
             * Add one or more events to the event cue.
             *
             * @example system.event.attach("contentAddedAbove", function (e) {});
             * @example system.event.attach("contentAddedAbove", function (e) {}, true);
             * @example system.event.attach(["contentAddedAbove", "contentRemovedAbove"], function (e) {});
             * @example system.event.attach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, true);
             * @example system.event.attach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, [true, false]);
             * @param   name (string || array)             The name of the event or an array of names of events.
             * @param   func (function)                    The function to call when the event it triggered.
             * @param   once (boolean || array) (optional) Whether or not to detach this function after being executed once. If "name" is an array, then "once" can also be an array of booleans.
             * @return  NULL
             * @note    If func(e) calls e.stopPropagation(), it will stop further event propagation.
             * @todo    Determine the value of adding a run_once property that removes function after the first run.
             */
            attach: function attach(name, func, once)
            {
                var arr_len,
                    i;
                
                /// Should the function be attached to multiple events?
                if (name instanceof Array) {
                    arr_len = name.length;
                    for (i = 0; i < arr_len; i += 1) {
                        /// If "once" is an array, then use the elements of the array.
                        /// If "once" is not an array, then just send the "once" variable each time.
                        this.attach(name[i], func, once instanceof Array ? once[i] : once);
                    }
                } else {
                    if (typeof func === "function") {
                        /// Has a function been previously attached to this event? If not, create a function to handle them.
                        if (!func_list[name]) {
                            func_list[name] = [];
                        }
                        func_list[name][func_list[name].length] = {
                            func: func,
                            once: once
                        };
                    }
                }
            },
            /**
             * Remove an event from the event cue.
             *
             * @example system.event.detach("contentAddedAbove", function (e) {});
             * @example system.event.detach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, [true, false]);
             * @example system.event.detach(["contentAddedAbove", "contentRemovedAbove"], function (e) {}, true);
             * @param   name (string || array)             The name of the event or an array of names of events.
             * @param   func (function)                    The function that was attached to the specified event.
             * @param   once (boolean || array) (optional) Whether or not to detach this function after being executed once. If "name" is an array, then "once" can also be an array of booleans.
             */
            detach: function detach(name, func, once)
            {
                var i;
                
                /// Are there multiple events to remove?
                if (name instanceof Array) {
                    for (i = name.length - 1; i >= 0; i -= 1) {
                        /// If "once" is an array, then use the elements of the array.
                        /// If "once" is not an array, then just send the "once" variable each time.
                        this.detach(name[i], func, once instanceof Array ? once[i] : once);
                    }
                } else if (func_list[name]) {
                    for (i = func_list[name].length - 1; i >= 0; i -= 1) {
                        ///NOTE: Both func and once must match.
                        if (func_list[name][i].func === func && func_list[name][i].once === once) {
                            G.array_remove(func_list[name], i);
                            /// Since only one event should be removed at a time, we can end now.
                            return;
                        }
                    }
                }
            },
            /**
             * Trigger the functions attached to an event.
             *
             * @param  name (string) The name of the event to trigger.
             * @param  e    (object) The event object sent to the called functions.
             * @return NULL
             */
            trigger: function trigger(name, e)
            {
                var func_arr_len,
                    i,
                    stop_propagation;
                
                /// Does this event have any functions attached to it?
                if (func_list[name]) {
                    func_arr_len = func_list[name].length;
                    
                    if (!G.is_object(e)) {
                        /// If the event object was not specificed, it needs to be created in order to attach stopPropagation() to it.
                        e = {};
                    }
                    
                    /// If an attached function runs this function, it will stop calling other functions.
                    e.stopPropagation = function ()
                    {
                        stop_propagation = true;
                    };
                    
                    for (i = 0; i < func_arr_len; i += 1) {
                        ///NOTE: It would be a good idea to use a try/catch to prevent errors in events from preventing the code that called the
                        ///      event from firing.  However, there would need to be some sort of error handling. Sending a message back to the
                        ///      server would be a good feature.
                        /// Check to make sure the function actually exists.
                        if (func_list[name][i]) {
                            func_list[name][i].func(e);
                        }
                        
                        /// Is this function only supposed to be executed once?
                        if (!func_list[name][i] || func_list[name][i].once) {
                            G.array_remove(func_list[name], i);
                        }
                        
                        /// Was e.stopPropagation() called?
                        if (stop_propagation) {
                            break;
                        }
                    }
                }
            }
        };
    }());
    
    return G;
}());