// The slices of Web Serial and the File System Access API that /host uses.
// TypeScript's DOM library carries neither (both are Chromium-led), so they
// are declared here, and every use goes through these accessors, which return
// null where the browser has no such API.

export type SerialPortInfo = { usbVendorId?: number; usbProductId?: number };

export type SerialOpenOptions = {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd";
  bufferSize?: number;
  flowControl?: "none" | "hardware";
};

export interface WebSerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly connected?: boolean;
  open(options: SerialOpenOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
}

export interface WebSerial extends EventTarget {
  requestPort(options?: { filters?: SerialPortInfo[] }): Promise<WebSerialPort>;
  getPorts(): Promise<WebSerialPort[]>;
}

export function webSerial(): WebSerial | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { serial?: WebSerial }).serial ?? null;
}

type SaveFilePicker = (options: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<FileSystemFileHandle>;

export function saveFilePicker(): SaveFilePicker | null {
  if (typeof window === "undefined") return null;
  const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  return picker ? picker.bind(window) : null;
}

export function describePort(port: WebSerialPort): string {
  const { usbVendorId, usbProductId } = port.getInfo();
  if (usbVendorId === undefined) return "Serial port";
  const hex = (n: number | undefined) => (n ?? 0).toString(16).padStart(4, "0");
  return `USB ${hex(usbVendorId)}:${hex(usbProductId)}`;
}

/** The same physical board, compared by USB ids (a replug may hand back a new object). */
export function samePort(a: WebSerialPort, b: WebSerialPort): boolean {
  if (a === b) return true;
  const x = a.getInfo();
  const y = b.getInfo();
  return x.usbVendorId !== undefined && x.usbVendorId === y.usbVendorId && x.usbProductId === y.usbProductId;
}
