export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function whatsappLink(phone: string, message: string) {
  const onlyDigits = phone.replace(/\D/g, "");
  return `https://wa.me/${onlyDigits}?text=${encodeURIComponent(message)}`;
}