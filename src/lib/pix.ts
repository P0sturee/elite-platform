// Static Pix "copia e cola" (BR Code / EMV) with a fixed amount.
const field = (id: string, value: string) => id + String(value.length).padStart(2, "0") + value;

const clean = (s: string, max: number) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim().slice(0, max);

function crc16(payload: string) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixPayload(opts: { key: string; name: string; city: string; amountCents: number; txid?: string; description?: string }) {
  const account =
    field("00", "br.gov.bcb.pix") +
    field("01", opts.key.trim()) +
    (opts.description ? field("02", clean(opts.description, 40)) : "");
  const txid = (opts.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    field("54", (opts.amountCents / 100).toFixed(2)) +
    field("58", "BR") +
    field("59", clean(opts.name, 25) || "ELITE SYSTEMS") +
    field("60", clean(opts.city, 15) || "CURITIBA") +
    field("62", field("05", txid)) +
    "6304";
  return payload + crc16(payload);
}
