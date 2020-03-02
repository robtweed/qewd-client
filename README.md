# qewd-client: ES6 Module version of QEWD Client
 
Rob Tweed <rtweed@mgateway.com>  
02 March 2020, M/Gateway Developments Ltd [http://www.mgateway.com](http://www.mgateway.com)  

Twitter: @rtweed

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)


# About this Repository

This repository contains an ES6 Module that provides the client functionality for QEWD
Applications.


# Using the QEWD Client

This client is already installed in the official Docker versions of QEWD Server.

Otherwise, use *git clone* to copy the module to your system.

The QEWD Client is completely self-contained and loads its dependencies automatically.
First, create an *app.js* file for your application, eg:


        import {QEWD} from './qewd-client.js';
        // adjust the path for the qewd-client module depending on where you've saved it

        document.addEventListener('DOMContentLoaded', function() {

          QEWD.on('ewd-registered', function() {

            // Your QEWD environment is ready

            // optionally turn on logging to the console
            QEWD.log = true;

            // now you can begin sending QEWD messages, eg:
  
            QEWD.send({
              type: 'hello world'
            }, function(responseObj) {
              console.log('response: ' + JSON.stringify(responseObj));
            });

            // etc
          });

          // start the QEWD service and register your application
          QEWD.start({
            application: 'hello-world'
          });

        });


Then create an *index.html* file that loads your app.js module:

        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Hello World Demo</title>
          </head>
          <body>
            <script type="module" src="app.js"></script>
          </body>
        </html>


Make sure the QEWD back-end is running and load your *index.html* page into your browser, and it should all burst into life.

For further information, see the tutorials in the 
[QEWD-Baseline](https://github.com/robtweed/qewd-baseline) repository.


## License

 Copyright (c) 2020 M/Gateway Developments Ltd,                           
 Redhill, Surrey UK.                                                      
 All rights reserved.                                                     
                                                                           
  http://www.mgateway.com                                                  
  Email: rtweed@mgateway.com                                               
                                                                           
                                                                           
  Licensed under the Apache License, Version 2.0 (the "License");          
  you may not use this file except in compliance with the License.         
  You may obtain a copy of the License at                                  
                                                                           
      http://www.apache.org/licenses/LICENSE-2.0                           
                                                                           
  Unless required by applicable law or agreed to in writing, software      
  distributed under the License is distributed on an "AS IS" BASIS,        
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
  See the License for the specific language governing permissions and      
   limitations under the License.      
