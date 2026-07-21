export function toIso(value: Date): string {
  return value.toISOString();
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function startOfIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function endOfIsoDate(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}
