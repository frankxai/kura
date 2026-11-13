import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function transpile(relativePath) {
  return ts.transpileModule(fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
}

function loadModule(code, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, crypto, TextEncoder, URL, setTimeout, structuredClone,
    ...globals,
  });
  return module.exports;
}

// Execute the committed TypeScript implementation. The mocks supply Chrome's
// boundary behavior; they do not reimplement admission or task state changes.
const contractsCode = transpile('../src/founder/contracts.ts');
const runtimeCode = transpile('../src/founder/runtime.ts');
const researchCode = transpile('../src/founder/research.ts');
const studioCode = transpile('../src/studio/task.ts');

async function fixture(mode) {
  const contracts = loadModule(contractsCode);
  const studio = loadModule(studioCode);
  const research = loadModule(researchCode, {
    require(name) {
      if (name === './contracts') return contracts;
      assert.equal(name, '../studio/task');
      return studio;
    },
  });
  const listeners = [];
  const tab = { id: 9, url: 'https://company.example/', status: 'complete' };
  let documentId = 'original-document';
  let stored = {};
  const events = { reads: 0, writes: 0, injections: [], navigations: [] };
  const snapshot = {
    url: tab.url, title: 'Fixture Company', description: '',
    text: 'A sufficiently long and readable company statement.', selection: '',
    links: [{ title: 'About', url: 'https://company.example/about' }],
  };
  const source = {
    ...snapshot, sha256: await contracts.digest(JSON.stringify(snapshot)),
    capturedAt: new Date().toISOString(), tabId: tab.id, documentId,
  };
  const dossier = { ...contracts.compileDossier(source), savedAt: new Date().toISOString() };
  const task = contracts.planFollowup(dossier, snapshot.links[0].url, 'local:fixture');
  if (mode === 'research') {
    const secondSnapshot = { ...snapshot, url: 'https://second.example/', title: 'Second fixture', links: [] };
    const secondSource = { ...source, ...secondSnapshot, sha256: await contracts.digest(JSON.stringify(secondSnapshot)), tabId: 10, documentId: 'second-document' };
    const secondDossier = { ...contracts.compileDossier(secondSource), savedAt: new Date().toISOString() };
    stored[contracts.FOUNDER_KEY] = { schema: 1, current: dossier, collection: [dossier, secondDossier], tasks: [], receipts: [] };
  }
  if (mode === 'replace-before-effect') {
    stored[contracts.FOUNDER_KEY] = {
      schema: 1, current: dossier, collection: [dossier], tasks: [task], receipts: [],
    };
  }
  const chrome = {
    runtime: {
      id: 'fixture', getURL: path => `chrome-extension://fixture/${path}`,
      onMessage: { addListener: listener => listeners.push(listener) },
    },
    commands: { onCommand: { addListener() {} } },
    storage: { local: {
      async get(key) {
        events.reads++;
        if (mode === 'navigate-during-load') tab.url = 'https://company.example/private';
        return { [key]: structuredClone(stored[key]) };
      },
      async set(value) {
        events.writes++;
        stored = { ...stored, ...structuredClone(value) };
        if (mode === 'replace-before-effect' && stored[contracts.FOUNDER_KEY]?.tasks.some(item => item.status === 'executing')) {
          documentId = 'replacement-document';
          tab.url = 'https://unrelated.example/private';
        }
      },
      async remove(key) { delete stored[key]; },
    } },
    tabs: {
      async get() { return { ...tab }; },
      async update(_id, options) {
        events.navigations.push(options.url);
        tab.url = options.url;
        return { ...tab };
      },
    },
    scripting: {
      async executeScript(options) {
        events.injections.push(options.target);
        if (options.target.documentIds) {
          // Chromium refuses an injection when its requested document no
          // longer belongs to the tab; no script or navigation then runs.
          if (!options.target.documentIds.includes(documentId)) throw new Error('No document with the requested id.');
          events.navigations.push(options.args[0].target);
          tab.url = options.args[0].target;
          return [];
        }
        return [{
          documentId,
          result: options.func.name === 'readPage'
            ? { snapshot: { ...snapshot, url: tab.url }, observedUrl: tab.url }
            : tab.url,
        }];
      },
    },
  };
  const runtime = loadModule(runtimeCode, {
    chrome,
    require(name) {
      if (name === './research') return research;
      assert.equal(name, './contracts');
      return contracts;
    },
  });
  runtime.installFounderRuntime(Promise.resolve());
  assert.equal(listeners.length, 1);
  return {
    contracts, events, task,
    stored: () => stored,
    send(message, sender = { id: 'fixture', url: 'chrome-extension://fixture/founder.html', tab: { id: 40 } }) {
      return new Promise(resolve => listeners[0](message, sender, resolve));
    },
  };
}

test('capture rejects an invited URL changed during storage await without injecting or persisting', async () => {
  const app = await fixture('navigate-during-load');
  const result = await app.send({
    type: 'KURA_FOUNDER_CAPTURE', tabId: 9, url: 'https://company.example/',
  }, { id: 'fixture', url: 'chrome-extension://fixture/popup.html' });
  assert.match(result.error, /invited tab navigated/i);
  assert.equal(app.events.reads, 1);
  assert.equal(app.events.injections.length, 0);
  assert.equal(app.events.writes, 0);
  assert.equal(app.stored()[app.contracts.FOUNDER_KEY], undefined);
});

test('approved navigation cannot act on a replacement document after the executing-state write', async () => {
  const app = await fixture('replace-before-effect');
  const result = await app.send({ type: 'KURA_FOUNDER_APPROVE', id: app.task.missionId });
  assert.equal(result.error, undefined);
  const finalInjection = app.events.injections.at(-1);
  assert.equal(finalInjection.tabId, 9);
  assert.deepEqual(Array.from(finalInjection.documentIds), ['original-document']);
  assert.deepEqual(app.events.navigations, []);
  assert.equal(result.state.tasks[0].status, 'uncertain');
  assert.equal(app.stored()[app.contracts.FOUNDER_KEY].tasks[0].status, 'uncertain');
  assert.equal(result.state.receipts.some(receipt => receipt.action === 'failure'), true);
});

test('webpage and foreign-extension senders cannot read or mutate Founder state', async () => {
  const app = await fixture('ordinary');
  for (const sender of [
    { id: 'fixture', url: 'https://company.example/', tab: { id: 9 } },
    { id: 'foreign-extension', url: 'chrome-extension://fixture/founder.html' },
    { id: 'fixture', url: 'chrome-extension://fixture/founder.html?spoof=1' },
  ]) {
    const result = await app.send({ type: 'KURA_FOUNDER_GET' }, sender);
    assert.match(result.error, /trusted Starlight panel/);
  }
  assert.equal(app.events.reads, 0);
  assert.equal(app.events.writes, 0);
  assert.deepEqual(app.events.injections, []);
  assert.deepEqual(app.events.navigations, []);
});

test('the exact owned extension page remains usable when Chrome supplies sender.tab', async () => {
  const app = await fixture('ordinary');
  const result = await app.send({ type: 'KURA_FOUNDER_GET' });
  assert.equal(result.error, undefined);
  assert.equal(result.state.schema, 1);
  assert.equal(app.events.reads, 1);
});

test('research rejects IDs outside the saved local collection before mutation or browser access', async () => {
  const app = await fixture('research');
  const saved = app.stored()[app.contracts.FOUNDER_KEY];
  const result = await app.send({ type: 'KURA_FOUNDER_RESEARCH', ids: [saved.collection[0].id, 'foreign-dossier'], objective: 'Compare the evidence.' });
  assert.match(result.error, /no longer in the local collection/);
  assert.equal(app.events.writes, 0);
  assert.deepEqual(app.events.injections, []);
  assert.deepEqual(app.events.navigations, []);
  assert.equal(app.stored()[app.contracts.FOUNDER_KEY].current.id, saved.current.id);
});

test('research compiles only the saved snapshots without reading browser tabs or granting actions', async () => {
  const app = await fixture('research');
  const saved = app.stored()[app.contracts.FOUNDER_KEY];
  const result = await app.send({ type: 'KURA_FOUNDER_RESEARCH', ids: saved.collection.map(item => item.id), objective: 'Compare the evidence.' });
  assert.equal(result.error, undefined);
  assert.equal(result.state.current.schema, 'starlight.research-dossier.v2');
  assert.equal(result.state.current.sources.length, 2);
  assert.equal(result.state.current.savedAt, undefined);
  assert.equal(result.state.current.claims.every(claim => claim.status === 'source-stated'), true);
  assert.equal(result.state.tasks.length, 0);
  assert.equal(result.state.collection.length, 2);
  assert.equal(result.state.receipts[0].action, 'compile');
  assert.equal(app.events.writes, 1);
  assert.deepEqual(app.events.injections, []);
  assert.deepEqual(app.events.navigations, []);
});
