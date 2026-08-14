/** Client-side input helpers — pair with server validation. */

export function lettersOnly(value: string): string {
  return value.replace(/[^a-zA-Z\s.'-]/g, "");
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function phoneDigits(value: string): string {
  return value.replace(/[^0-9+]/g, "").slice(0, 15);
}

export function alphanumCallUp(value: string): string {
  return value.replace(/[^a-zA-Z0-9/\-_]/g, "").toUpperCase();
}
