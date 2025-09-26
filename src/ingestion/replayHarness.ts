import type { ImuPacket } from './imuMapper';
import { Parserator, type ParseratorOptions } from './parserator';

export interface ReplayOptions extends ParseratorOptions {
  tickIntervalMs?: number;
}

export function replayDataset(packets: ImuPacket[], options: ReplayOptions = {}) {
  const parserator = new Parserator(options);
  const interval = options.tickIntervalMs ?? 16;

  let index = 0;
  function dispatchNext() {
    if (index >= packets.length) return;
    parserator.ingest(packets[index]);
    index += 1;
    if (index < packets.length) {
      setTimeout(dispatchNext, interval);
    }
  }

  dispatchNext();
  return parserator;
}
