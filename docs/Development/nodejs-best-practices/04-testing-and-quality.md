---
sidebar_position: 4
---

# Testing & Quality

Conventions for writing readable, isolated, and trustworthy tests, plus lightweight static-analysis habits that keep a Node.js codebase healthy over time.

---

## Table of Contents

1. [Naming Tests Clearly](#naming-tests-clearly)
2. [Structuring Tests with AAA](#structuring-tests-with-aaa)
3. [Keeping Test Data Local to Each Test](#keeping-test-data-local-to-each-test)
4. [Testing the Five Possible Outcomes](#testing-the-five-possible-outcomes)
5. [Mocking External HTTP Services](#mocking-external-http-services)
6. [Testing Middlewares in Isolation](#testing-middlewares-in-isolation)
7. [Randomizing Ports in Tests](#randomizing-ports-in-tests)
8. [Refactoring with Static Analysis](#refactoring-with-static-analysis)
9. [Automating Version Bumps](#automating-version-bumps)
10. [Further Reading](#further-reading)

---

## Naming Tests Clearly

A test's name is often the only artifact a reader sees when a test report runs — the person reading it (a reviewer, an on-call engineer, or you in two years) rarely has the test body open. A good test name should stand on its own as a mini requirements statement, made up of three parts:

**Unit under test:** what is being exercised — e.g. `ProductService.addNewProduct`.

**Scenario:** the conditions under which it's exercised — e.g. "no price is specified".

**Expectation:** the observable outcome — e.g. "the product is pending approval".

When all three are encoded in the `describe`/`it` hierarchy, a full test run reads like a requirements document rather than a wall of pass/fail noise.

### ✅ Do — encode unit, scenario, and expectation

```javascript
describe('Products Service', () => {
  describe('Add new product', () => {
    it('When no price is specified, then the product status is pending approval', () => {
      const newProduct = new ProductService().add({ name: 'iPhone' });
      expect(newProduct.status).toBe('pendingApproval');
    });
  });
});
```

### ❌ Avoid — vague names that hide intent

```javascript
describe('Products Service', () => {
  describe('Add new product', () => {
    it('Should return the right status', () => {
      // What scenario? What status? You have to read the whole body to find out.
      const newProduct = new ProductService().add({ name: 'iPhone' });
      expect(newProduct.status).toBe('pendingApproval');
    });
  });
});
```

---

## Structuring Tests with AAA

Production code already consumes most of your attention, so test code has to be readable at a glance — declarative, not imperative. The **Arrange-Act-Assert** pattern (the same idea as xUnit's "Setup, Exercise, Verify") gives every test a predictable shape:

**Arrange:** set up the scenario — instantiate the unit, seed data, configure stubs.

**Act:** invoke the unit under test. Ideally a single line.

**Assert:** check the result matches expectations. Ideally a single line.

Separating the three phases — even with just a blank line and a comment — lets a reader jump straight to the part they care about instead of parsing a wall of setup and verification mixed together.

### ✅ Do — separate the three phases

```javascript
describe('Customer classifier', () => {
  test('When customer spent more than $500, should be classified as premium', () => {
    // Arrange
    const customerToClassify = { spent: 505, joined: new Date(), id: 1 };
    jest.spyOn(dataAccess, 'getCustomer')
      .mockResolvedValue({ id: 1, classification: 'regular' });

    // Act
    const receivedClassification = customerClassifier.classify(customerToClassify);

    // Assert
    expect(receivedClassification).toBe('premium');
  });
});
```

### ❌ Avoid — one undifferentiated block

```javascript
test('Should be classified as premium', () => {
  const customerToClassify = { spent: 505, joined: new Date(), id: 1 };
  jest.spyOn(dataAccess, 'getCustomer').mockResolvedValue({ id: 1, classification: 'regular' });
  const receivedClassification = customerClassifier.classify(customerToClassify);
  expect(receivedClassification).toBe('premium');
});
```

A useful trick when writing new tests: draft the **Assert** first. Asking "if this worked, how would I know?" forces you to pin down the expected outcome before worrying about setup.

---

## Keeping Test Data Local to Each Test

The golden rule of testing is that each test case should be trivially easy to reason about in isolation. That breaks down the moment tests rely on shared, pre-seeded fixtures — a `before`/`beforeAll` hook that loads a JSON seed file or runs a migration once for the whole suite. It's tempting for performance reasons, but it couples tests together: one test mutating a "shared" record silently breaks another test that assumed the record was untouched, and test order starts to matter.

Instead, have every test create the exact records it needs and act only on those records. If seeding performance genuinely matters, restrict shared fixtures to read-only suites that never mutate data — never to suites that write.

### ✅ Do — each test owns its data

```javascript
it('When updating site name, get successful confirmation', async () => {
  // Arrange — this test creates its own record
  const siteUnderTest = await SiteService.addSite({ name: 'siteForUpdateTest' });

  // Act
  const updateResult = await SiteService.changeName(siteUnderTest, 'newName');

  // Assert
  expect(updateResult).toBe(true);
});
```

### ❌ Avoid — tests depend on a shared, external seed

```javascript
before(async () => {
  // Where does this data live? Some seed.json nobody in this file can see.
  await DB.addSeedDataFromJson('seed.json');
});

it('When updating site name, get successful confirmation', async () => {
  const siteToUpdate = await SiteService.getSiteByName('Portal'); // assumes seed.json ran
  const updateResult = await SiteService.changeName(siteToUpdate, 'newName');
  expect(updateResult).toBe(true);
});

it('When querying by site name, get the right site', async () => {
  const siteToCheck = await SiteService.getSiteByName('Portal');
  expect(siteToCheck.name).toBe('Portal'); // Fails — the previous test already renamed it!
});
```

---

## Testing the Five Possible Outcomes

When a test triggers an action, it should verify every externally observable effect of that action, not just the most obvious one. Most flows produce some combination of five outcome categories:

**Response:** the direct return value or HTTP response — status code, payload shape, headers.

**State change:** data that should have been persisted or mutated. Checking only the response and skipping the actual data store is one of the most common testing gaps — a handler can return `200 OK` while silently failing to save anything.

**External call:** a call the component makes to a collaborator — sending an email, charging a card, calling another service. These should be verified the same way a response is.

**Message queuing:** a message published to a queue or event bus so downstream consumers can continue the flow.

**Observability:** the error handling, logging, and metrics a failure should produce. A failed transaction should not just return the right error to the caller — it should also emit whatever the on-call engineer needs to diagnose it.

Treating these five as a checklist when designing a test suite catches gaps that "does the endpoint return 200" testing misses entirely — a test can pass on the response while the state change, external call, or logging is silently wrong.

---

## Mocking External HTTP Services

A component under test should never depend on a real third-party API being up, fast, or in a particular state. Intercept outgoing HTTP calls at the network level and return controlled responses instead — [nock](https://www.npmjs.com/package/nock) is the standard tool for this in Node.js. Network-level interception keeps the test a true black box: the code under test is untouched, only the wire is faked.

This isolation buys you two things: speed and determinism (no flaky network calls), and the ability to simulate scenarios that are hard to trigger against a real service — a 404, a malformed payload, a timeout. A good test suite is a flight simulator: the value isn't simulating blue skies, it's simulating storms.

The tradeoff is that mocks can drift from the real API's behavior without anyone noticing. Compensate with a small number of contract or end-to-end tests that hit the real service.

### ✅ Do — intercept the call and control the response

```javascript
beforeEach(() => {
  nock('http://localhost/user/').get('/1').reply(200, { id: 1, name: 'John' });
});

test('When the user does not exist, return http 404', async () => {
  // Arrange
  nock('http://localhost/user/').get('/7').reply(404, {
    message: 'User does not exist',
    code: 'nonExisting',
  });
  const orderToAdd = { userId: 7, productId: 2, mode: 'draft' };

  // Act
  const result = await axiosAPIClient.post('/order', orderToAdd);

  // Assert
  expect(result.status).toBe(404);
});
```

### ✅ Do — assert on the outgoing request, not just the response

```javascript
test('When order fails, send mail to admin', async () => {
  let emailPayload;
  nock('http://mailer.com')
    .post('/send', (payload) => ((emailPayload = payload), true))
    .reply(202);

  await axiosAPIClient.post('/order', { userId: 1, productId: 2, mode: 'approved' });

  expect(emailPayload).toMatchObject({
    subject: expect.any(String),
    body: expect.any(String),
    recipientAddress: expect.stringMatching(/^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/),
  });
});
```

### ✅ Do — block any request that isn't explicitly mocked

```javascript
beforeAll(() => {
  // Fail loudly on any unmocked outbound call
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1'); // allow calls to the app under test itself
});
```

### ❌ Avoid — hitting the real network in a unit/component test

```javascript
test('When the user does not exist, return http 404', async () => {
  // No interception — this depends on a real, reachable third-party service
  const result = await axiosAPIClient.post('/order', { userId: 7, productId: 2 });
  expect(result.status).toBe(404); // flaky, slow, and can't simulate this scenario on demand
});
```

---

## Testing Middlewares in Isolation

Express middlewares are frequently under-tested, either because they look like a small slice of the system or because testers assume they need a live server to exercise them. Neither reason holds up: a middleware is a plain function of `(req, res, next)`, and it can be invoked directly with fake `req`/`res` objects — no server, no open port, no HTTP client involved.

[node-mocks-http](https://www.npmjs.com/package/node-mocks-http) builds realistic mock `req`/`res` objects and lets you spy on what the middleware did to them — the status code it set, the headers it added, whether it called `next()`. This turns a middleware test into a fast, pure unit test.

### ✅ Do — invoke the middleware directly with mocked req/res

```javascript
const unitUnderTest = require('./middleware');
const httpMocks = require('node-mocks-http');

test('A request without an authentication header returns http 403', () => {
  const request = httpMocks.createRequest({
    method: 'GET',
    url: '/user/42',
    headers: { authentication: '' },
  });
  const response = httpMocks.createResponse();

  unitUnderTest(request, response);

  expect(response.statusCode).toBe(403);
});
```

### ❌ Avoid — spinning up a full server just to test one middleware

```javascript
test('A request without an authentication header returns http 403', async () => {
  const app = express();
  app.use(authMiddleware);
  app.get('/user/:id', (req, res) => res.sendStatus(200));
  const server = app.listen(0);

  const response = await request(server).get('/user/42'); // no auth header
  expect(response.status).toBe(403);

  server.close(); // more moving parts, slower, and harder to isolate failures
});
```

---

## Randomizing Ports in Tests

Component and integration tests should start the web server in the same process as the test runner — that's what unlocks mocking, coverage instrumentation, and fast iteration. But most test runners run suites across multiple worker processes, and if each process starts a server on the same hardcoded port, they collide.

The fix is simple: use a fixed port in production, but let the server bind to an [ephemeral port](https://en.wikipedia.org/wiki/Ephemeral_port) (port `0`) in tests, so the OS assigns a free one automatically.

### ✅ Do — let the OS pick a port in tests, fix it in production

```javascript
// api-under-test.js
const initializeWebServer = async () => {
  return new Promise((resolve) => {
    // Fixed port in production, ephemeral (0) port in testing
    const webServerPort = process.env.PORT ? process.env.PORT : 0;
    const expressApp = express();
    const connection = expressApp.listen(webServerPort, () => resolve(expressApp));
  });
};

// test.js
beforeAll(async () => {
  app = await initializeWebServer(); // never assume a specific port
});
```

### ❌ Avoid — hardcoding the port everywhere

```javascript
const connection = expressApp.listen(3000); // collides the moment two test workers run in parallel
```

---

## Refactoring with Static Analysis

Refactoring — cleaning up duplicated code, long methods, long parameter lists, and other "code smells" — is a normal, continuous part of iterative development, not a one-off cleanup phase. The problem is that these smells are easy to miss by eye as a codebase grows.

Static analysis tools (SonarQube, Code Climate) close that gap by scanning for duplication, cyclomatic complexity, and other maintainability signals across single files and across the whole codebase. Wire one into CI so a build fails — or at least warns — when it introduces a new smell, the same way a linter fails a build on style violations.

It's worth distinguishing the two tool categories: **linters** (ESLint) mostly catch style issues — indentation, missing semicolons, occasionally an overly long function — scoped to a single file. **Static analysis** tools look for structural problems — duplicate logic, excessive complexity — often across multiple files. Use both; they complement rather than replace each other.

As Martin Fowler puts it, refactoring is "a controlled technique for improving the design of an existing code base" — controlled meaning it's backed by tests and measured by tooling, not ad hoc rewrites.

---

## Automating Version Bumps

Manually editing the version field in `package.json` before every release is easy to forget and easy to get wrong — a patch release tagged as a major, or a version bump that isn't reflected in a git tag. Treat versioning as part of the release pipeline rather than a manual step.

Tools like [`standard-version`](https://www.npmjs.com/package/standard-version) or [`semantic-release`](https://www.npmjs.com/package/semantic-release) read [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `feat!:`) from git history, compute the correct semver bump automatically, update `package.json`, generate a changelog, and create the matching git tag — all as a CI step.

### ✅ Do — derive the version from commit history in CI

```json
// package.json
{
  "scripts": {
    "release": "standard-version"
  }
}
```

```bash
# CI release step — no human decides the version number
npm run release && git push --follow-tags
```

### ❌ Avoid — hand-editing the version before publishing

```json
// A developer manually bumps this and sometimes forgets, or picks the wrong semver level
{
  "version": "2.3.1"
}
```

---

## Further Reading

- [nodebestpractices — Testing & Quality](https://github.com/goldbergyoni/nodebestpractices) (CC BY-SA 4.0)
