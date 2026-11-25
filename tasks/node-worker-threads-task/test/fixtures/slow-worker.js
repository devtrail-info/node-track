// A worker that keeps the CPU busy for 1.5 s, then stops without answering.
const end = Date.now() + 1500;
while (Date.now() < end) {
  // busy
}
