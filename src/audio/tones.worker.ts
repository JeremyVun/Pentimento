import { renderAsset, type Asset } from './tones';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Asset>) => void) | null;
  postMessage(message: unknown, transfer: Transferable[]): void;
};

scope.onmessage = (e) => {
  const raw = renderAsset(e.data);
  scope.postMessage({ asset: e.data, raw }, [raw.data.buffer]);
};
