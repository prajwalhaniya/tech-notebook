---
sidebar_position: 6
---

# Security

An OWASP-aligned checklist for hardening Node.js and Express applications.

---

## Table of Contents

1. [Input Validation & Injection Prevention](#input-validation--injection-prevention)
2. [Authentication & Session Security](#authentication--session-security)
3. [Dependency & Secret Management](#dependency--secret-management)
4. [HTTP Hardening](#http-hardening)
5. [Runtime & Process Isolation](#runtime--process-isolation)
6. [Rate Limiting & DoS Protection](#rate-limiting--dos-protection)
7. [Further Reading](#further-reading)

---

## Input Validation & Injection Prevention

Almost every serious Node.js vulnerability traces back to trusting data that came from outside the process — a request body, a query string, a file path, a regular expression built from user input. Treat all of it as hostile until proven otherwise.

### Validate Every Incoming Payload

Be explicit about what shape of data your app accepts, and reject anything that doesn't match — as early as possible, ideally in middleware before a route handler ever sees the request. Schema validation narrows the attack surface (malformed payloads, unexpected types, oversized strings) and doubles as free documentation of your API contract. [Zod](https://www.npmjs.com/package/zod) and [Joi](https://www.npmjs.com/package/joi) are the most common choices in modern Node/Express apps; JSON Schema libraries like [jsonschema](https://www.npmjs.com/package/jsonschema) work well when the same schema needs to be shared with a frontend.

**✅ Do:** validate with a schema library before touching the request body.

```javascript
const { z } = require('zod');

const productSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ errors: result.error.issues });
    }
    req.body = result.data; // use the parsed, coerced value
    next();
  };
}

router.post('/products', validate(productSchema), async (req, res) => {
  // req.body is guaranteed to match productSchema here
});
```

**❌ Avoid:** trusting `req.body` directly, or validating deep inside business logic after the data has already been used.

```javascript
router.post('/products', async (req, res) => {
  await db.products.insert(req.body); // whatever shape it is
});
```

### Avoid `eval`, `new Function`, and Friends

`eval()`, `new Function()`, and the string form of `setTimeout`/`setInterval` all compile and execute arbitrary strings as JavaScript. If any part of that string can be influenced by user input, an attacker has effectively gained code execution on your server — not "a bug," but full compromise.

**❌ Avoid:**

```javascript
// an attacker-controlled string reaches eval
const userInput = "require('child_process').exec('rm -rf /')";
eval(userInput);

// string-based timers are eval in disguise
setTimeout("doSomething(" + req.query.id + ")", 1000);
```

**✅ Do:** refactor so the logic is expressed in real code paths instead of dynamically evaluated strings.

```javascript
setTimeout(() => doSomething(Number(req.query.id)), 1000);
```

If you truly need to execute untrusted JavaScript (a plugin system, a user-supplied script), don't reach for `eval` at all — isolate it, as described in [Runtime & Process Isolation](#runtime--process-isolation).

### Guard Against ReDoS in Regular Expressions

Node.js runs your application code on a single thread. A regular expression with a vulnerable pattern — typically one with nested or repeating capturing groups like `(a|aa)+` or `([a-zA-Z]+)*` — can take exponential time on a crafted input, freezing the event loop and taking down every request the process is handling. This is a Regular Expression Denial of Service (ReDoS), and it's on the [OWASP list of vulnerable RegEx patterns](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS).

**✅ Do:** prefer a maintained validation library over hand-rolled regex, and lint for unsafe patterns.

```javascript
const validator = require('validator');

if (!validator.isEmail(userInput)) {
  return res.status(400).send('Invalid email');
}
```

```javascript
const safe = require('safe-regex');

safe(/^([a-zA-Z0-9])(([\-.]|[_]+)?([a-zA-Z0-9]+))*(@){1}.../); // false — vulnerable, don't ship it
```

**❌ Avoid:** writing ad hoc regex for validating untrusted, variable-length input without checking its complexity first.

### Prevent SQL and NoSQL Injection

Manually concatenated queries and unvalidated filters are the two easiest ways to open an injection hole. Use an ORM/ODM or query builder that supports parameterized queries by default — [TypeORM](https://github.com/typeorm/typeorm), [Sequelize](https://github.com/sequelize/sequelize), [Mongoose](https://github.com/Automattic/mongoose), [Knex](https://github.com/knex/knex), and [Objection.js](https://github.com/Vincit/objection.js) all do this — and pair it with the input validation described above, since NoSQL injection often exploits *operators* (`$where`, `$gt`) rather than string escaping.

**❌ Avoid:**

```javascript
// SQL: string concatenation
db.query(`SELECT * FROM users WHERE id = '${req.params.id}'`);

// NoSQL: user input reaches a $where clause and can run arbitrary JS
db.balances.find({
  active: true,
  $where: (obj) => obj.credits - obj.debits < req.body.userInput,
});
```

**✅ Do:**

```javascript
// SQL: parameterized query via query builder
await knex('users').where({ id: req.params.id }).first();

// NoSQL: validated, typed input compared with a plain operator
const threshold = Number(req.body.threshold);
db.balances.find({ active: true, credits: { $lt: threshold } });
```

### Escape Output to Prevent XSS

Rendering untrusted data into HTML, CSS, JavaScript, or a URL without escaping lets an attacker's stored input execute as code in another user's browser — classic Cross-Site Scripting. Templating engines like EJS, Pug, React, and Angular escape interpolated values by default; know their edge cases (raw-HTML helpers, `dangerouslySetInnerHTML`) and never disable escaping for user-controlled data. When you build HTML by hand, use a dedicated escaping library rather than ad hoc string replacement — [`escape-html`](https://github.com/component/escape-html) for HTML, and context-aware encoding for attributes, JavaScript, and CSS, since HTML-entity encoding alone does not neutralize script contexts.

**❌ Avoid:**

```javascript
res.send(`<div>${req.query.comment}</div>`); // comment could be <script>...</script>
```

**✅ Do:**

```javascript
const escapeHtml = require('escape-html');
res.send(`<div>${escapeHtml(req.query.comment)}</div>`);
```

Defense in depth: also set a `Content-Security-Policy` header (see [HTTP Hardening](#http-hardening)) so that even an escaping mistake has a second line of defense.

### Never Load Modules or Files from a Dynamic Path

Passing a variable straight into `require()` or `fs.readFile()` means whoever controls that variable controls which file your process loads or reads — a direct path to remote code execution or arbitrary file disclosure if that variable ever traces back to user input.

**❌ Avoid:**

```javascript
const helperPath = req.query.helper;
const helpers = require(helperPath); // attacker picks the module

fs.readFile(req.query.path, callback); // attacker picks the file
```

**✅ Do:** hardcode the module/file path, or resolve user input against a fixed allowlist of known-safe values.

```javascript
const uploadHelpers = require('./helpers/upload');

const allowedReports = { sales: 'sales.csv', users: 'users.csv' };
const file = allowedReports[req.query.report];
if (!file) return res.status(400).send('Unknown report');
fs.readFile(path.join(REPORTS_DIR, file), callback);
```

### Be Cautious with Child Processes

`child_process.exec()` runs its argument through a shell, so any unsanitized input laced with shell metacharacters (`&&`, `|`, `;`, backticks) can execute arbitrary commands on the host. If you must run a command based on external input: avoid it entirely if possible; otherwise strictly validate/allowlist the input, prefer `execFile`/`spawn` with an argument array (which bypasses the shell) over `exec` with a concatenated string, run the process under a restricted user, and consider sandboxing it (see [Runtime & Process Isolation](#runtime--process-isolation)).

**❌ Avoid:**

```javascript
const { exec } = require('child_process');
exec(`/path/to/script.sh --option ${input}`); // input = "&& rm -rf --no-preserve-root /"
```

**✅ Do:**

```javascript
const { execFile } = require('child_process');
execFile('/path/to/script.sh', ['--option', input]); // input is a literal argument, not shell syntax
```

---

## Authentication & Session Security

### Hash Passwords — Never Store Them as Plain Text

Storing plaintext or reversibly-encrypted passwords means a single database leak compromises every account. Passwords must be hashed with an algorithm designed to be slow and salted, so brute-forcing a stolen hash is computationally expensive. [`bcrypt`](https://www.npmjs.com/package/bcrypt) is the standard choice for most Node.js apps (minimum cost factor `12`); Node's native `crypto.scrypt` is a solid alternative with no external dependency and no 64-character password limit; `PBKDF2` exists mainly for FIPS/government compliance. Never roll your own hashing, and never use `Math.random()` anywhere near credential or token generation — it's not cryptographically secure.

**✅ Do:**

```javascript
const bcrypt = require('bcrypt');

const hash = await bcrypt.hash(plainTextPassword, 12); // store `hash`, never the raw password

const isMatch = await bcrypt.compare(loginAttempt, hash);
if (!isMatch) {
  return res.status(401).send('Invalid credentials');
}
```

**❌ Avoid:**

```javascript
// storing the password as-is, or with reversible "encryption"
await db.users.insert({ email, password: req.body.password });

// hand-rolled, fast, unsalted hashing
const hash = crypto.createHash('md5').update(password).digest('hex');
```

### Expire and Blacklist JWTs

JWTs are stateless by design — once signed, a token is valid until it expires, and there's no built-in way to revoke a specific one. Always set a short `expiresIn` so a leaked token has a small blast radius, and if you need to support immediate logout or account compromise response, maintain a revocation list (keyed by the token's `jti` claim) in a shared store like Redis so it works across every Node.js process, not just the one that issued the token.

**✅ Do:**

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
  expiresIn: '15m', // short-lived access token
  jwtid: crypto.randomUUID(),
});
```

```javascript
// revocation via express-jwt-blacklist, backed by Redis/Memcached (never the default in-memory store)
const blacklist = require('express-jwt-blacklist');
blacklist.configure({ tokenId: 'jti', store: { type: 'redis', host: '127.0.0.1' } });

app.use(jwt({ secret: process.env.JWT_SECRET, isRevoked: blacklist.isRevoked }));

app.post('/logout', (req, res) => {
  blacklist.revoke(req.user);
  res.sendStatus(200);
});
```

**❌ Avoid:** issuing tokens with no expiration, or with a lifetime of days/weeks for something as sensitive as an access token.

```javascript
const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET); // never expires
```

### Harden Session Cookie Settings

Session middleware like `express-session` ships with defaults that favor convenience over security. Change the cookie `name` away from the library default (`connect.sid` for `express-session`) so an attacker can't fingerprint your stack; set `cookie.secure: true` so the session cookie is only ever sent over HTTPS; set `httpOnly: true` so client-side JavaScript — and therefore a successful XSS payload — cannot read it; and set a reasonable `maxAge` instead of a session that lives forever.

**✅ Do:**

```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'sid', // not the framework default
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
  },
}));
```

**❌ Avoid:** shipping the framework's default session config to production — `connect.sid`, `secure: false`, no `maxAge`.

### Rate-Limit Login and Other Sensitive Endpoints

Login, password-reset, and admin routes are the highest-value targets for brute-force and credential-stuffing attacks. Rate limiting general traffic (see [Rate Limiting & DoS Protection](#rate-limiting--dos-protection)) isn't tight enough here — track failed attempts specifically, keyed by both IP and username/IP pair, and block after a small threshold. On failure, always return a generic error rather than revealing whether the username or the password was wrong.

**✅ Do:**

```javascript
const { RateLimiterRedis } = require('rate-limiter-flexible');

// block an IP+username pair after 10 consecutive failed logins
const loginLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'login_fail_consecutive',
  points: 10,
  duration: 60 * 60 * 24 * 90,
  blockDuration: 60 * 60, // 1 hour block
});

app.post('/login', async (req, res) => {
  const key = `${req.body.username}_${req.ip}`;
  const rl = await loginLimiter.get(key);
  if (rl !== null && rl.remainingPoints <= 0) {
    return res.status(429).send('Too many attempts, try again later');
  }

  const valid = await verifyCredentials(req.body.username, req.body.password);
  if (!valid) {
    await loginLimiter.consume(key);
    return res.status(401).send('Invalid credentials'); // never say which field was wrong
  }

  await loginLimiter.delete(key);
  // issue session/token
});
```

**❌ Avoid:** leaving `/login` unprotected, or returning distinct errors like "unknown username" vs. "wrong password" that help an attacker enumerate valid accounts.

---

## Dependency & Secret Management

### Manage Secrets with Environment Variables or a Vault

API keys, database credentials, and signing secrets belong outside your source code entirely. The standard approach is environment variables, read via `process.env` — a good litmus test is whether your repository could go public right now without leaking a single credential. For secrets that genuinely must live in the deployment artifact, use a managed secrets service (AWS Secrets Manager, HashiCorp Vault, Google Cloud KMS) rather than plaintext config, and enforce commit-time scanning with a tool like [`git-secrets`](https://github.com/awslabs/git-secrets) so an accidental `git add .env` never reaches source control.

**✅ Do:**

```javascript
const apiKey = process.env.AZURE_STORAGE_KEY;
const blobService = azure.createBlobService(apiKey);
```

```bash
# .gitignore
.env
.env.*
```

**❌ Avoid:**

```javascript
// hardcoded, committed secret
const apiKey = 'sk_live_51Hxyz...';
```

### Avoid Publishing Secrets to the npm Registry

`.gitignore` and `.npmignore` are independent files — when both exist, `.npmignore` *overrides* `.gitignore` for what `npm publish` includes. A file you correctly kept out of git can still end up published to the public npm registry if you forgot to also exclude it from the package. Prefer a `files` allowlist in `package.json` over an `.npmignore` blocklist where practical, and always verify with a dry run before publishing.

**✅ Do:**

```json
{
  "files": ["dist/index.js", "dist/index.d.ts"]
}
```

```bash
npm publish --dry-run   # inspect exactly what would be published
```

**❌ Avoid:** relying solely on `.gitignore` and assuming it also governs `npm publish` — it doesn't.

### Continuously Audit Dependencies for Known Vulnerabilities

The typical Node.js app pulls in hundreds of transitive dependencies, any of which can ship a disclosed vulnerability after you've already installed it — this is explicitly called out in the OWASP Top 10 ("Vulnerable and Outdated Components"). Run `npm audit` (built into npm 6+) as part of CI, or adopt a dedicated service like [Snyk](https://snyk.io/), which also opens automatic pull requests with fixes. Tools like Greenkeeper/Renovate/Dependabot keep dependencies patched proactively instead of reactively.

```bash
npm audit                 # report known vulnerabilities in the dependency tree
npm audit fix              # apply available non-breaking patches
```

**✅ Do:** wire `npm audit --audit-level=high` (or Snyk) into CI so a vulnerable dependency fails the build, not just a manual check months later.

**❌ Avoid:** installing dependencies once and never revisiting them — vulnerabilities are disclosed continuously, against versions you already shipped.

### Embrace Security-Focused Lint Rules

Static analysis catches unsafe patterns — unsafe regex, `eval()` with a variable, non-literal filesystem paths, insecure randomness — before they ever reach review. [`eslint-plugin-security`](https://github.com/eslint-community/eslint-plugin-security) adds exactly these checks to your existing ESLint setup for close to zero cost.

```javascript
// eslint.config.js
const security = require('eslint-plugin-security');

module.exports = [
  security.configs.recommended,
];
```

Rules like `detect-eval-with-expression`, `detect-non-literal-fs-filename`, `detect-non-literal-regexp`, and `detect-pseudoRandomBytes` directly flag several of the vulnerabilities covered above (`eval`, dynamic file paths, ReDoS, weak randomness) at commit time rather than in production.

---

## HTTP Hardening

### Serve Everything Over HTTPS/TLS

An unencrypted connection lets anyone on the network path read or tamper with requests and responses — including session cookies and credentials — via a man-in-the-middle attack. With free certificate authorities like [Let's Encrypt](https://letsencrypt.org/), there is no longer a meaningful tradeoff against running plain HTTP. Terminate TLS either directly in Node (via the `https` module) or, more commonly, at a reverse proxy like nginx or a load balancer in front of it.

```javascript
const https = require('https');
const fs = require('fs');
const app = require('./app');

const options = {
  cert: fs.readFileSync('./sslcert/fullchain.pem'),
  key: fs.readFileSync('./sslcert/privkey.pem'),
};

https.createServer(options, app).listen(443);
```

### Set Security Headers with Helmet

A handful of HTTP response headers meaningfully reduce common attack surfaces — clickjacking, MIME sniffing, protocol downgrade, and XSS — but Express sets none of them by default. [Helmet](https://www.npmjs.com/package/helmet) applies sane defaults for all of them in one line, and lets you tune each individually:

- **`Strict-Transport-Security`** (HSTS): tells browsers to only ever connect over HTTPS, closing the window for protocol-downgrade attacks.
- **`X-Frame-Options: DENY`**: blocks your pages from being embedded in a hostile `<iframe>` (clickjacking).
- **`X-Content-Type-Options: nosniff`**: stops browsers from guessing a different MIME type than the one you declared.
- **`Content-Security-Policy`**: restricts which origins scripts, styles, and other resources may load from — a strong defense-in-depth layer against XSS.
- **`Referrer-Policy`**: controls how much of your URL structure leaks to third-party sites via the `Referer` header.

**✅ Do:**

```javascript
const helmet = require('helmet');
app.use(helmet());

// tune individual policies as needed
app.use(
  helmet.contentSecurityPolicy({
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] },
  }),
);
```

**❌ Avoid:** shipping an Express app with no security headers set at all, or manually reimplementing what Helmet already does correctly.

### Prevent Unsafe Redirects

A redirect endpoint that echoes an unvalidated `url` query parameter is an open redirect — attackers post links that point at *your* trusted domain but ultimately bounce the victim to a phishing site, which is far more convincing than a raw phishing URL. Never redirect straight to user-supplied input; validate it against a strict allowlist or require it to be a relative, same-origin path.

**❌ Avoid:**

```javascript
app.get('/login', (req, res) => {
  if (req.session.isAuthenticated()) {
    res.redirect(req.query.url); // attacker sets url=https://evil.example
  }
});
```

**✅ Do:**

```javascript
const allowlist = new Set(['https://trusted-partner.example']);

function getSafeRedirect(url) {
  if (url.match(/^\/(?!\/)/)) return url; // relative, same-origin path only
  return allowlist.has(url) ? url : '/';
}

app.get('/login', (req, res) => {
  if (req.session.isAuthenticated()) {
    res.redirect(getSafeRedirect(req.query.url));
  }
});
```

### Hide Error Details from the Client

A stack trace in an HTTP response hands an attacker your file paths, third-party module versions, and internal logic for free. Express's default error handler includes the stack trace whenever `NODE_ENV` is not `production` — make sure production deployments actually set that, and add your own final error-handling middleware that never leaks internals to the client, logging the full detail server-side instead.

**✅ Do:**

```javascript
// last middleware in the stack
app.use((err, req, res, next) => {
  logger.error(err); // full detail goes to your logs, not the client
  res.status(err.status || 500).json({ message: 'Internal server error' });
});
```

**❌ Avoid:**

```javascript
app.use((err, req, res, next) => {
  res.status(500).send(err.stack); // leaks paths, dependency versions, internals
});
```

---

## Runtime & Process Isolation

### Run Node.js as a Non-Root User

Under the principle of least privilege, a compromised process should only be able to do as much damage as the privileges it was running with. If an attacker achieves code execution in a process running as root, they gain root on the host — full control, not a contained incident. Node.js apps almost never need root: bind to a non-privileged port (above 1024) and let a reverse proxy like nginx forward 80/443 to it, and in Docker, explicitly run as the unprivileged `node` user rather than the container default of root.

**✅ Do:**

```dockerfile
FROM node:latest

COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

**❌ Avoid:** running `node server.js` as root just to bind to port 80, or shipping a Docker image that never drops out of the default root user.

### Sandbox Untrusted Code

Run only your own JavaScript — but real systems sometimes need to execute code supplied at runtime (a plugin system, a user-submitted script, a build-time loader). Do that in an isolated environment that limits what the untrusted code can see and how long it can run: a dedicated child process with a hard execution timeout, a serverless/FaaS invocation, or a purpose-built library like [`vm2`](https://www.npmjs.com/package/vm2) — noting that VM-based sandboxes trade simplicity for weaker isolation guarantees than a real process or container boundary.

```javascript
const Sandbox = require('sandbox');
const s = new Sandbox();

s.run('while (true) {}', (output) => {
  console.log(output); // 'Timeout' — the infinite loop can't hang the host process
});

s.run('process.platform', (output) => {
  console.log(output); // null — sandboxed code has no access to Node internals
});
```

### Crypto Hygiene: Timing-Safe Comparisons and Secure Randomness

Two small crypto habits prevent subtle but real vulnerabilities. First, comparing secrets (API keys, HMAC digests, session tokens) with a normal `===` or string comparison exits early on the first mismatched character — the tiny timing difference between "failed on character 1" and "failed on character 20" is enough for an attacker to reconstruct the secret byte-by-byte in a timing attack. Use `crypto.timingSafeEqual()`, which always takes the same amount of time regardless of where the mismatch occurs. Second, never use `Math.random()` for anything security-sensitive (tokens, password-reset codes, API keys) — it's a fast, predictable PRNG, not a cryptographic one. Use `crypto.randomBytes()`, which draws from the OS's secure entropy source.

**✅ Do:**

```javascript
const crypto = require('crypto');

const isValid = crypto.timingSafeEqual(Buffer.from(providedDigest), Buffer.from(expectedDigest));

const resetToken = crypto.randomBytes(32).toString('hex');
```

**❌ Avoid:**

```javascript
if (providedDigest === expectedDigest) { /* vulnerable to timing attacks */ }

const resetToken = Math.random().toString(36); // predictable, not cryptographically secure
```

---

## Rate Limiting & DoS Protection

### Limit Concurrent Requests

An application with no request throttling will happily accept as many concurrent requests as clients send — legitimate traffic spikes and deliberate floods look identical to it until resources run out. Put rate limiting in front of the app (nginx, a load balancer) and/or inside it, using a middleware like [`express-rate-limit`](https://www.npmjs.com/package/express-rate-limit) for route-scoped limits or [`rate-limiter-flexible`](https://www.npmjs.com/package/rate-limiter-flexible) for finer control backed by Redis across multiple Node.js processes.

**✅ Do:**

```javascript
const rateLimit = require('express-rate-limit');

app.enable('trust proxy'); // needed behind a proxy so req.ip is the real client IP

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});

app.use('/api/', apiLimiter);
```

**❌ Avoid:** exposing any route — especially expensive ones like search or report generation — with no ceiling on request volume per client.

### Limit Request Payload Size

Parsing request bodies is expensive, and an attacker who can send an unbounded payload can exhaust memory or CPU with a single request, or several in parallel — a cheap denial-of-service vector. Cap payload size both in your body-parsing middleware and, ideally, at the reverse proxy in front of your app, so oversized requests are rejected before they even reach Node.

**✅ Do:**

```javascript
app.use(express.json({ limit: '300kb' })); // default is 100kb; make the ceiling explicit
```

```nginx
# nginx.conf
http {
  client_max_body_size 1m;
}
```

**❌ Avoid:**

```javascript
app.use(express.json()); // unlimited effective ceiling, depending on defaults and proxy config
```

---

## Further Reading

- [nodebestpractices — Security Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
