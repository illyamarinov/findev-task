import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const RECORD_WORDS = 7;
const wasm = await readFile(new URL('../public/market-producer.wasm', import.meta.url));

async function createProducer() {
  const { instance } = await WebAssembly.instantiate(wasm);
  return instance.exports;
}

function generateRows(producer, count) {
  const pointer = producer.generateBatch(count);
  assert.ok(pointer > 0);
  assert.equal(pointer % Int32Array.BYTES_PER_ELEMENT, 0);

  // Copy before the next call overwrites the shared Wasm buffer.
  const words = Array.from(new Int32Array(producer.memory.buffer, pointer, count * RECORD_WORDS));
  return Array.from({ length: count }, (_, index) =>
    words.slice(index * RECORD_WORDS, (index + 1) * RECORD_WORDS),
  );
}

test('returns exactly the requested number of valid updates at both batch limits', async () => {
  const producer = await createProducer();
  assert.equal(producer.configure(50, 12345), 1);

  for (const count of [1, 1_000]) {
    const rows = generateRows(producer, count);
    assert.equal(rows.length, count);

    for (const row of rows) {
      const [
        instrumentIndex,
        priceCents,
        tradeQuantity,
        bidCents,
        askCents,
        bidQuantity,
        askQuantity,
      ] = row;
      assert.equal(row.length, RECORD_WORDS);
      assert.ok(instrumentIndex >= 0 && instrumentIndex < 50);
      assert.ok(priceCents > 0);
      assert.ok(tradeQuantity > 0);
      assert.ok(bidCents > 0 && bidCents < askCents);
      assert.ok(bidQuantity >= 0 && askQuantity >= 0);
      assert.ok(priceCents === bidCents || priceCents === askCents);
    }
  }
});

test('continues the same deterministic sequence across batch boundaries', async () => {
  const split = await createProducer();
  const combined = await createProducer();
  assert.equal(split.configure(5, 98765), 1);
  assert.equal(combined.configure(5, 98765), 1);

  const first = generateRows(split, 37);
  const second = generateRows(split, 63);
  assert.deepEqual([...first, ...second], generateRows(combined, 100));
});

test('tracks the evolving base price separately for every instrument', async () => {
  const producer = await createProducer();
  assert.equal(producer.configure(3, 112233), 1);

  const previousBasePrices = [10_000, 11_000, 12_000];
  const seen = new Set();

  for (const row of [...generateRows(producer, 500), ...generateRows(producer, 500)]) {
    const [instrumentIndex, , , bidCents, askCents] = row;
    const basePrice = (bidCents + askCents) / 2;
    assert.ok(Math.abs(basePrice - previousBasePrices[instrumentIndex]) <= 10);
    previousBasePrices[instrumentIndex] = basePrice;
    seen.add(instrumentIndex);
  }

  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test('reset reproduces the first batch and seed zero selects the fixed default', async () => {
  const producer = await createProducer();
  const defaultSeedProducer = await createProducer();
  assert.equal(producer.configure(5, 0), 1);
  const first = generateRows(producer, 100);
  generateRows(producer, 100);

  assert.equal(producer.configure(5, 0), 1);
  assert.deepEqual(generateRows(producer, 100), first);

  assert.equal(defaultSeedProducer.configure(5, 0x6d2b79f5), 1);
  assert.deepEqual(generateRows(defaultSeedProducer, 100), first);
});

test('rejects invalid inputs without changing a valid run', async () => {
  const producer = await createProducer();
  const reference = await createProducer();
  assert.equal(producer.generateBatch(1), 0);
  assert.equal(producer.configure(0, 1), 0);
  assert.equal(producer.configure(51, 1), 0);

  assert.equal(producer.configure(2, 24680), 1);
  assert.equal(reference.configure(2, 24680), 1);
  assert.deepEqual(generateRows(producer, 10), generateRows(reference, 10));

  assert.equal(producer.configure(0, 1), 0);
  assert.equal(producer.configure(51, 1), 0);
  assert.equal(producer.generateBatch(0), 0);
  assert.equal(producer.generateBatch(1_001), 0);
  assert.deepEqual(generateRows(producer, 10), generateRows(reference, 10));
});

test('reuses one output buffer without growing Wasm memory', async () => {
  const producer = await createProducer();
  assert.equal(producer.configure(50, 13579), 1);

  const pointer = producer.generateBatch(1);
  const initialMemorySize = producer.memory.buffer.byteLength;
  const firstWord = new Int32Array(producer.memory.buffer, pointer, 1);

  for (let index = 0; index < 500; index++) {
    assert.equal(producer.generateBatch(1_000), pointer);
  }

  assert.equal(producer.memory.buffer.byteLength, initialMemorySize);
  assert.equal(firstWord.buffer, producer.memory.buffer);
});
