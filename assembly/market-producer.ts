// A record contains seven i32 words in the same order as MarketUpdate.
// The returned buffer is reused by the next generateBatch call.
const MAX_INSTRUMENTS: i32 = 50;
const MAX_BATCH_SIZE: i32 = 1_000;
const RECORD_WORDS: i32 = 7;
const WORD_BYTES: i32 = 4;
const MIN_PRICE_CENTS: i32 = 100;
const MAX_PRICE_CENTS: i32 = 1_000_000;
const DEFAULT_SEED: u32 = 0x6d2b79f5;

const prices: usize = memory.data(MAX_INSTRUMENTS * WORD_BYTES, WORD_BYTES);
const batch: usize = memory.data(MAX_BATCH_SIZE * RECORD_WORDS * WORD_BYTES, WORD_BYTES);

let activeInstruments: i32 = 0;
let randomState: u32 = DEFAULT_SEED;

function nextRandom(): u32 {
  let value = randomState;
  value ^= value << 13;
  value ^= value >> 17;
  value ^= value << 5;
  randomState = value;
  return value;
}

// Returns 1 on success. Zero is reserved for invalid instrument counts.
// Seed zero uses the fixed default because xorshift32 cannot advance from zero.
export function configure(instrumentCount: i32, seed: i32): i32 {
  if (instrumentCount < 1 || instrumentCount > MAX_INSTRUMENTS) {
    return 0;
  }

  activeInstruments = instrumentCount;
  randomState = seed == 0 ? DEFAULT_SEED : <u32>seed;

  for (let index: i32 = 0; index < MAX_INSTRUMENTS; index++) {
    store<i32>(prices + <usize>(index * WORD_BYTES), 10_000 + index * 1_000);
  }

  return 1;
}

// Returns a pointer to exactly count records, or zero if not configured or count is invalid.
// All values are i32; each record is laid out as follows:
// instrumentIndex, priceCents, tradeQuantity, bidCents, askCents,
// bidQuantity, askQuantity.
export function generateBatch(count: i32): i32 {
  if (activeInstruments == 0 || count < 1 || count > MAX_BATCH_SIZE) {
    return 0;
  }

  for (let record: i32 = 0; record < count; record++) {
    const instrumentIndex = <i32>(nextRandom() % <u32>activeInstruments);
    const priceAddress = prices + <usize>(instrumentIndex * WORD_BYTES);
    const previousPrice = load<i32>(priceAddress);
    const step = <i32>(nextRandom() % 21) - 10;
    const basePrice = min<i32>(MAX_PRICE_CENTS, max<i32>(MIN_PRICE_CENTS, previousPrice + step));
    store<i32>(priceAddress, basePrice);

    const halfSpread = 1 + <i32>(nextRandom() % 5);
    const bidCents = basePrice - halfSpread;
    const askCents = basePrice + halfSpread;
    const priceCents = nextRandom() % 2 == 0 ? bidCents : askCents;
    const tradeQuantity = 1 + <i32>(nextRandom() % 1_000);
    const bidQuantity = <i32>(nextRandom() % 1_001);
    const askQuantity = <i32>(nextRandom() % 1_001);

    const address = batch + <usize>(record * RECORD_WORDS * WORD_BYTES);
    store<i32>(address, instrumentIndex);
    store<i32>(address + 4, priceCents);
    store<i32>(address + 8, tradeQuantity);
    store<i32>(address + 12, bidCents);
    store<i32>(address + 16, askCents);
    store<i32>(address + 20, bidQuantity);
    store<i32>(address + 24, askQuantity);
  }

  return <i32>batch;
}
