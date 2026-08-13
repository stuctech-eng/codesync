import type Anthropic from "@anthropic-ai/sdk"
import type { Project } from "@/types"
import { getGitHubTree, getFileContentsForProject } from "@/lib/snapshot"
import { isValidProjectPath } from "@/lib/path-validation"
import { isProtectedFile } from "@/lib/protected-files"

// Fase 2 — bewust uitsluitend deze twee, read-only tools (Master Plan
// v1.1, sectie 5/6). GEEN create_commit, delete_file, create_tag,
// restore_version, en GEEN prepare_changeset — dat komt pas in Fase 3.
export const CLAUDE_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_project_structure",
    description: "Haal de volledige bestandsboom van het huidige project op (alleen paden, geen inhoud). Gebruik dit eerst om te zien welke bestanden er zijn, voordat je specifieke bestanden opvraagt.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "get_file_contents",
    description: "Haal de inhoud van specifieke bestanden op uit het huidige project. Maximaal 10 paden per aanroep. Gebruik dit alleen voor bestanden die je op basis van de projectstructuur echt nodig hebt.",
    input_schema: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          maxItems: 10,
          description: "Relatieve bestandspaden binnen het project, bijv. 'app/page.tsx'"
        }
      },
      required: ["paths"],
      additionalProperties: false
    }
  }
]

const MAX_TOTAL_BYTES = 200_000 // groottebegrenzing bovenop het max. van 10 paden

export async function executeClaudeTool(
  toolName: string,
  input: Record<string, unknown>,
  project: Project
): Promise<{ result: string; isError: boolean }> {
  try {
    if (toolName === "get_project_structure") {
      const tree = await getGitHubTree(project)
      const paths = tree.map(f => f.path)
      return { result: JSON.stringify({ files: paths }), isError: false }
    }

    if (toolName === "get_file_contents") {
      const rawPaths = input.paths
      if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
        return { result: "Fout: 'paths' moet een niet-lege array zijn.", isError: true }
      }
      if (rawPaths.length > 10) {
        return { result: "Fout: maximaal 10 paden per aanroep.", isError: true }
      }

      // Padvalidatie — server-side, niet optioneel (correctie 8)
      const invalidPaths = rawPaths.filter(p => !isValidProjectPath(p))
      if (invalidPaths.length > 0) {
        return {
          result: `Fout: ongeldige paden geweigerd: ${invalidPaths.join(", ")}`,
          isError: true
        }
      }
      const validPaths = rawPaths as string[]

      // Protected files — code-niveau blokkade, geen instructie aan Claude
      const protectedPaths = validPaths.filter(isProtectedFile)
      const allowedPaths = validPaths.filter(p => !isProtectedFile(p))

      const files = allowedPaths.length > 0
        ? await getFileContentsForProject(project, allowedPaths)
        : []

      // Groottebegrenzing — voorkomt dat 10 zeer grote bestanden alsnog
      // een enorme tool_result opleveren
      let totalBytes = 0
      const includedFiles: { path: string; content: string }[] = []
      const truncatedFiles: string[] = []

      for (const file of files) {
        const size = Buffer.byteLength(file.content, "utf-8")
        if (totalBytes + size > MAX_TOTAL_BYTES) {
          truncatedFiles.push(file.path)
          continue
        }
        totalBytes += size
        includedFiles.push({ path: file.path, content: file.content })
      }

      const response: Record<string, unknown> = { files: includedFiles }
      if (protectedPaths.length > 0) {
        response.refused = protectedPaths.map(p => ({
          path: p,
          reason: "Dit bestand is beschermd en kan niet worden opgevraagd."
        }))
      }
      if (truncatedFiles.length > 0) {
        response.skippedDueToSize = truncatedFiles
      }

      return { result: JSON.stringify(response), isError: false }
    }

    return { result: `Onbekende tool: ${toolName}`, isError: true }

  } catch (error) {
    return { result: `Tool-fout: ${String(error)}`, isError: true }
  }
}
