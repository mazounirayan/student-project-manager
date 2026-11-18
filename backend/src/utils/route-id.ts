/** Express 5 also types wildcard parameters as arrays. IDs must be scalar. */
export function parseRouteId(value: string | string[] | undefined): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw Object.assign(new Error('Invalid resource ID'), { status: 400 });
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) throw Object.assign(new Error('Invalid resource ID'), { status: 400 });
  return id;
}
