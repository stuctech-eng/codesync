// Padvalidatie voor Claude-tools (Master Plan v1.1, sectie 6 / correctie 8).
// Wordt gebruikt door zowel get_file_contents als (in Fase 3) prepare_changeset,
// zodat beide dezelfde regels toepassen — geen los, ad-hoc gebouwde check per tool.
export function isValidProjectPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false
  if (path.startsWith("/")) return false
  if (path.startsWith("~")) return false
  if (path.includes("..")) return false
  if (path.includes("\0")) return false
  // Windows-achtige drive-letters of UNC-paden zijn hier nooit geldig
  if (/^[a-zA-Z]:/.test(path)) return false
  if (path.startsWith("\\\\")) return false
  return true
}
