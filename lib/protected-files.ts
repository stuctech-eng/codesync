// Protected files — Claude mag deze bestanden nooit via get_file_contents
// lezen, ongeacht wat er in het gesprek gevraagd wordt (Master Plan v1.1,
// sectie 4). Dit is een code-niveau blokkade, geen instructie die Claude
// "zou moeten volgen".
const PROTECTED_PATTERNS: RegExp[] = [
  /(^|\/)\.env(\..*)?$/i,
  /service[-_]?account.*\.json$/i,
  /secret/i,
  /credential/i,
  /(^|\/)\.git\//i,
  /private[-_]?key/i,
  /\.pem$/i,
  /\.pfx$/i
]

export function isProtectedFile(path: string): boolean {
  return PROTECTED_PATTERNS.some(pattern => pattern.test(path))
}
