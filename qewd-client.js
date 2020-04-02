/*

 ----------------------------------------------------------------------------
 | qewd-client: Browser (websocket & HTTP) Client for QEWD applications      |
 |                                                                           |
 | Copyright (c) 2016-20 M/Gateway Developments Ltd,                         |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | http://www.mgateway.com                                                   |
 | Email: rtweed@mgateway.com                                                |
 |                                                                           |
 |                                                                           |
 | Licensed under the Apache License, Version 2.0 (the "License");           |
 | you may not use this file except in compliance with the License.          |
 | You may obtain a copy of the License at                                   |
 |                                                                           |
 |     http://www.apache.org/licenses/LICENSE-2.0                            |
 |                                                                           |
 | Unless required by applicable law or agreed to in writing, software       |
 | distributed under the License is distributed on an "AS IS" BASIS,         |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  |
 | See the License for the specific language governing permissions and       |
 |  limitations under the License.                                           |
 ----------------------------------------------------------------------------

 2 April 2020

  Thanks to Ward DeBacker for enhancements to the client functionality
  Thanks to Sam Habiel for fix to emitter.off bug

 */

function loadJSFile(src, callback) {
  let script = document.createElement("script");
  script.type = "text/javascript";
  script.src = src
  script.onload = function(){
    if (callback) callback(src);
  };
  document.body.appendChild(script);
}

let events = {};

let emitter = {
  on: function(type, callback, deleteWhenFinished) {
    if (!events[type]) events[type] = [];
    events[type].push({
      callback: callback,
      deleteWhenFinished: deleteWhenFinished
    });
  },
  off: function(type, callback) {
    let event = events[type];
    if (typeof callback === 'function') {
      if (event) {
        for (let i = 0; i < event.length; i++) {
          if (event[i].callback === callback) {
            event.splice(i,1);
          }
        }
      }
    }
    else {
      event = [];
    }
    events[type] = event;
  },
  emit: function(type, data) {
    let ev = events[type];
    if (!ev || ev.length < 1) return;
    data = data || {};
    for (let i = 0; i < ev.length; i++) {
      let e = ev[i];
      e.callback(data);
      if (e.deleteWhenFinished && data.finished) ev.splice(i,1);
    }
  },
  eventExists: function(type) {
    return (typeof events[type] !== 'undefined');
  }
};

let start = function(application, $, customAjaxFn, url) {

  let QEWD = this;

  loadJSFile('/socket.io/socket.io.js', function() {

    let cookieName = 'QEWDSession';
    let appName = application;
    let jwt = false;
    let jwt_decode;
    let log = false;
    let io_path;

    if (typeof application === 'object') {
      $ = application.$;
      customAjaxFn = application.ajax;
      url = application.url;
      appName = application.application;
      cookieName = application.cookieName;
      jwt = application.jwt || false;
      jwt_decode = application.jwt_decode;
      log = application.log;
      io_path = application.io_path;
      application = appName;
    }

    function getCookie(name) {
      let value = "; " + document.cookie;
      let parts = value.split("; " + name + "=");
      if (parts.length == 2) return parts.pop().split(";").shift();
    }

    (function() {

      let token;
      let socket;
    
      QEWD.application = application;

      function registerEvent(messageObj, callback) {
        let cb = callback;
        let type = messageObj.type;
        if (type === 'ewd-fragment') {
          type = type + ':' + messageObj.params.file;
          let targetId = messageObj.params.targetId;
          let targetElement = messageObj.params.targetElement;
          if (!targetElement && targetId) {
            targetElement = document.getElementById(targetId);
          }
          let fragmentName = messageObj.params.file;
          cb = function(responseObj) {
            if (messageObj.params.append) {
              let span = document.createElement('span');
              span.innerHTML = responseObj.message.content;
              targetElement.appendChild(span);
            }
            else {
              targetElement.innerHTML = responseObj.message.content;
            }
            callback(fragmentName);
          }
          delete messageObj.params.targetId;
        }
        else if (jwt) {
          cb = function(responseObj) {
            if (responseObj.message && responseObj.message.token) token = responseObj.message.token;
            callback(responseObj);
          };
        }
        QEWD.on(type, cb, true);
      }

      function handleResponse(messageObj) {
        // messages received back from Node.js

        //if (QEWD.log && messageObj.type !== 'ewd-register') console.log('raw received: ' + JSON.stringify(messageObj));
        if (messageObj.message && messageObj.message.error && messageObj.message.disconnect) {
          if (typeof socket !== 'undefined') {
            socket.disconnect();
            console.log('Socket disconnected');
          }
          QEWD.send = function() {};
          QEWD.emit = function() {};
          console.log(messageObj.message.error);
          return;
        }
        if (messageObj.type === 'ewd-register') {
          token = messageObj.message.token;

          QEWD.setCookie = function(name) {
            name = name || 'ewd-token';
            document.cookie = name + "=" + token;
          };

          QEWD.updateTokenFromJWT = function() {
            token = getCookie('JSESSIONID');
          };

          if (!QEWD.jwt) {
            Object.defineProperty(QEWD, 'jwt', {
              get: function() {
                if (jwt && jwt_decode) return jwt_decode(token);
                return false;
              }
            });
          }

          console.log(application + ' registered');
          QEWD.emit('ewd-registered');
          return;
        }

        if (messageObj.type === 'ewd-reregister') {
          if (jwt && messageObj.message.token) token = messageObj.message.token; // update JWT with new session info (ie new socketId)
          console.log('Re-registered');
          QEWD.emit('ewd-reregistered');
          return;
        }

        if (QEWD.log) console.log('received: ' + JSON.stringify(messageObj));

        if (messageObj.type === 'ewd-fragment') {
           if (messageObj.message.error) {
             QEWD.emit('error', messageObj);
             return;
           }
           QEWD.emit('ewd-fragment:' + messageObj.message.fragmentName, messageObj);
           return;
        }

        if (messageObj.message && messageObj.message.error) {
          let ok = QEWD.emit('error', messageObj);
          if (ok) return;
        }

        if (jwt) {
          if (messageObj.message && !messageObj.message.error) {
            if (messageObj.message.token) {
              // update token with latest JWT
              token = messageObj.message.token;
              //console.log('ewd-client: token - ' + token);
            }
          }
        }

        QEWD.emit(messageObj.type, messageObj);
      }

      function ajax(messageObj, callback) {
        if (callback) {
          registerEvent(messageObj, callback);
        }
        if (token) {
          messageObj.token = token;
        }
        if (token || messageObj.type === 'ewd-register') {
          messageObj.token = token;
          console.log('Ajax send: ' + JSON.stringify(messageObj));
          (function(type) {

            function success(data) {
              console.log('Ajax response for type ' + type + ': ' + JSON.stringify(data));
              if (data.ewd_response !== false) {
                handleResponse({
                  type: type,
                  message: data,
                  finished: true
                });
              }
            }

            function fail(error) {
              console.log('Error occurred: ' + error);
              let messageObj = {
                message: {error: error}
              };
              QEWD.emit('error', messageObj);
            }

            let params = {
              url: (url ? url : '') + '/ajax',
              type: 'post',
              contentType: 'application/json',
              data: messageObj,
              dataType: 'json',
              timeout: 10000
            };

            if (customAjaxFn) {
              customAjaxFn(params, success, fail);
            }
            else if (typeof $ !== 'undefined') {
              $.ajax({
                url: params.url,
                type: params.type,
                contentType: params.contentType,
                data: JSON.stringify(params.data),
                dataType: params.dataType,
                timeout: params.timeout
              })
              .done(function(data) {
                success(data);
              })
              .fail(function(err, textStatus, errorThrown) {
                let error = err.responseJSON.error;
                fail(error);
              });
            }
            else {
              console.log('Error: No Ajax handler function is available');
            }
          }(messageObj.type));
          delete messageObj.token;
          if (QEWD.log) console.log('sent: ' + JSON.stringify(messageObj));
        }
      }

      QEWD.send = function(messageObj, callback) {
        if (messageObj.ajax) {
          ajax(messageObj, callback);
          return;
        }
        if (callback) {
          registerEvent(messageObj, callback);
        }
        if (token) {
          messageObj.token = token;
          //if (messageObj.type = 'ewd-register') messageObj.jwt = jwt;
          socket.emit('ewdjs', messageObj);
          delete messageObj.token;
          if (QEWD.log) console.log('sent: ' + JSON.stringify(messageObj));
        }
      };

      let replyPromise = function(messageObj) {
        return new Promise((resolve) => {
          QEWD.send(messageObj, function(responseObj) {
            resolve(responseObj);
          });
        });
      };

      QEWD.reply = async function(message) {
        return await replyPromise(message);
      };

      QEWD.getFragment = function(params, callback) {
        QEWD.send({
          type: 'ewd-fragment',
          service: params.service || false,
          params: {
            file: params.name,
            targetId: params.targetId,
            targetElement: params.targetElement,
            append: params.append
          }
        }, callback);
      };

      if (io) {
        if (url) {
          let options = {
            transports: ['websocket'] // needed for react-native
          };
          if (io_path) {
            if (QEWD.log) console.log('Setting custom socket.io path to ' + io_path);
            options.path = io_path + '/socket.io';
          }

          socket = io(url, options);
        }
        else {
          if (io_path) {
            if (QEWD.log) console.log('Setting custom socket.io path to ' + io_path);
            socket = io({path: path + '/socket.io'});
          }
          else {
            socket = io.connect();
          }
        }

        socket.on('connect', function() {

          QEWD.disconnectSocket = function() {
            socket.disconnect();
            console.log('QEWD disconnected socket');
          };
          let message;
          if (!token && cookieName && getCookie(cookieName)) token = getCookie(cookieName);

          if (token) {
            // re-connection occured - re-register to attach to original Session
            message = {
              type: 'ewd-reregister',
              token: token
            };
          }
          else {
            message = {
              type: 'ewd-register',
              application: application,
              jwt: jwt
            };
          }
          socket.emit('ewdjs', message);
        }); 

        socket.on('ewdjs', handleResponse);

        socket.on('disconnect', function() {
          console.log('*** server has disconnected socket, possibly because it shut down or because token has expired');
          QEWD.emit('socketDisconnected');
        });

      }
      else {
        QEWD.send = ajax;
        QEWD.send({
          type: 'ewd-register',
          application: application
        });
      }

    })();

    // render socket.io etc inaccessible from console!
    QEWD.start = function() {};
    io = null;
    customAjaxFn = null;
  });
}

let ewd = function() {
  this.application = 'undefined';
  this.log = false;
};

let proto = ewd.prototype;
proto.on = emitter.on;
proto.off = emitter.off;
proto.emit = emitter.emit;
proto.eventExists = emitter.eventExists;
proto.start = start;

let QEWD = new ewd();
export {QEWD};



