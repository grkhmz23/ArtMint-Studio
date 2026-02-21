export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}
