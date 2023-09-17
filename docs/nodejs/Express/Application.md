---
sidebar_position: 1
---

This is an explanation of each code in an `express/lib/application.js`. This files seems as the starting point of creating an express application. So, let's understand how this actually works.

```js
/**
 * Module variables.
 * @private
 */

var hasOwnProperty = Object.prototype.hasOwnProperty
var slice = Array.prototype.slice;

```

what are module variables?

Module variables are typically private to the module, meaning they are not accessible from outside the module unless explicitly exported. Module variables are used to store data, configuration settings, or functions that are relevant to the functionality of the module.

`hasOwnProperty`: A reference to the hasOwnProperty method of the `Object.prototype`.

`slice`: A reference to the slice method of the `Array.prototype`.

```js
/**
 * Variable for trust proxy inheritance back-compat
 * @private
 */

var trustProxyDefaultSymbol = '@@symbol:trust_proxy_default';

```
What do you mean by trust proxy settings?

`Trust proxy settings` refer to a configuration option that determines whether the application should trust or consider `proxy server headers` when processing incoming HTTP requests. These headers can provide information about the client's connection, which may have passed through one or more `proxy servers` before reaching the application.

Proxy servers are intermediaries that can sit between a client (e.g., a web browser) and a web server. When a client makes an HTTP request to a server, the request can pass through one or more proxy servers before reaching the destination server. Each proxy server in the chain may add its own headers to the HTTP request to provide information about the client's connection. Some common proxy-related headers include:

`X-Forwarded-For`: Contains the IP addresses of the client and any intermediary proxy servers.
`X-Forwarded-Proto`: Indicates the protocol (HTTP or HTTPS) used by the client.
`X-Forwarded-Host`: Specifies the original host requested by the client.
`X-Forwarded-Port`: Specifies the original port requested by the client.

These headers are added for various purposes, such as load balancing, security, and logging.

`Trust Proxy Enabled`: When trust proxy is enabled, the application will use the values provided in proxy headers (e.g., X-Forwarded-For, X-Forwarded-Proto) to determine the client's IP address, protocol, host, and port. This is useful when the application is hosted behind a proxy, as it ensures that the application correctly identifies the client's information.

`Trust Proxy Disabled` (Default): When trust proxy is disabled (which is often the default setting), the application will use the direct connection information provided by the client. It will not consider proxy headers. This setting is suitable for situations where the application is directly accessible by clients without going through proxy servers.

```js
/**
 * Initialize the server.
 *
 *   - setup default configuration
 *   - setup default middleware
 *   - setup route reflection methods
 *
 * @private
 */

app.init = function init() {
  this.cache = {};
  this.engines = {};
  this.settings = {};

  this.defaultConfiguration();
};
```
`app.init` is a method that is assigned to the prototype (app). This means that it's available to all instances of the Express application.

Inside the init function:

`this.cache = {};`: It initializes an empty object called cache. This object can be used for various caching purposes, such as storing frequently accessed data to improve performance.

`this.engines = {};`: It initializes an empty object called engines. This object is often used to register template engines for rendering dynamic views in the application.

`this.settings = {};`: It initializes an empty object called settings. This object can be used to store and manage various application settings and configurations.

```js
app.defaultConfiguration = function defaultConfiguration() {
  var env = process.env.NODE_ENV || 'development';

  // default settings
  this.enable('x-powered-by');
  this.set('etag', 'weak');
  this.set('env', env);
  this.set('query parser', 'extended');
  this.set('subdomain offset', 2);
  this.set('trust proxy', false);

  // trust proxy inherit back-compat
  Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
    configurable: true,
    value: true
  });

  debug('booting in %s mode', env);

  this.on('mount', function onmount(parent) {
    // inherit trust proxy
    if (this.settings[trustProxyDefaultSymbol] === true
      && typeof parent.settings['trust proxy fn'] === 'function') {
      delete this.settings['trust proxy'];
      delete this.settings['trust proxy fn'];
    }

    // inherit protos
    setPrototypeOf(this.request, parent.request)
    setPrototypeOf(this.response, parent.response)
    setPrototypeOf(this.engines, parent.engines)
    setPrototypeOf(this.settings, parent.settings)
  });

  // setup locals
  this.locals = Object.create(null);

  // top-most app is mounted at /
  this.mountpath = '/';

  // default locals
  this.locals.settings = this.settings;

  // default configuration
  this.set('view', View);
  this.set('views', resolve('views'));
  this.set('jsonp callback name', 'callback');

  if (env === 'production') {
    this.enable('view cache');
  }

  Object.defineProperty(this, 'router', {
    get: function() {
      throw new Error('\'app.router\' is deprecated!\nPlease see the 3.x to 4.x migration guide for details on how to update your app.');
    }
  });
};
```

