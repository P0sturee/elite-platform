// Pix key types and normalization to the format the DICT (Banco Central) expects.
export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "evp";

export const PIX_KEY_TYPES: Record<PixKeyType, { label: string; placeholder: string }> = {
  phone: { label: "Telefone", placeholder: "(41) 99999-9999" },
  cnpj: { label: "CNPJ", placeholder: "00.000.000/0001-00" },
  cpf: { label: "CPF", placeholder: "000.000.000-00" },
  email: { label: "E-mail", placeholder: "financeiro@empresa.com.br" },
  evp: { label: "Chave aleatória", placeholder: "123e4567-e89b-12d3-a456-426614174000" },
};

function validCpf(d: string) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    const sum = d.slice(0, len).split("").reduce((s, n, i) => s + Number(n) * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return (r === 10 ? 0 : r) === Number(d[len]);
  };
  return check(9) && check(10);
}

function validCnpj(d: string) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const check = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((s, w, i) => s + Number(d[i]) * w, 0);
    const r = sum % 11;
    return (r < 2 ? 0 : 11 - r) === Number(d[len]);
  };
  return check(12) && check(13);
}

/** Returns the key in DICT format, or an error message in Portuguese. */
export function normalizePixKey(type: PixKeyType, raw: string): { key: string } | { error: string } {
  const value = raw.trim();
  const digits = value.replace(/\D/g, "");
  switch (type) {
    case "cpf":
      return validCpf(digits) ? { key: digits } : { error: "CPF inválido. Confira os números." };
    case "cnpj":
      return validCnpj(digits) ? { key: digits } : { error: "CNPJ inválido. Confira os números." };
    case "phone": {
      const national = digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
      return /^\d{2}9?\d{8}$/.test(national) ? { key: `+55${national}` } : { error: "Telefone inválido. Use DDD + número, ex.: (41) 99999-9999." };
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 77
        ? { key: value.toLowerCase() }
        : { error: "E-mail inválido." };
    case "evp":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
        ? { key: value.toLowerCase() }
        : { error: "Chave aleatória inválida (formato 8-4-4-4-12)." };
  }
}

/** Best guess for keys saved before the type existed. */
export function guessPixKeyType(key: string): PixKeyType {
  const digits = key.replace(/\D/g, "");
  if (key.includes("@")) return "email";
  if (/^[0-9a-f-]{36}$/i.test(key)) return "evp";
  if (key.startsWith("+")) return "phone";
  if (digits.length === 14 && validCnpj(digits)) return "cnpj";
  if (digits.length === 11 && validCpf(digits)) return "cpf";
  return "phone";
}
