export function createProjectionFromDto<T extends {}>(dto: new () => T): Record<keyof T, number> {
  const dtoInstance = new dto();
  const keys = Object.keys(dtoInstance) as Array<keyof T>;
  const projection = {} as Record<keyof T, number>;
  keys.forEach((key) => (projection[key] = 1));
  return projection;
}
