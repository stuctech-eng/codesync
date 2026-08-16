import type Anthropic from "@anthropic-ai/sdk"
import type { Project } from "@/types"
import { getGitHubTree, getFileContentsForProject } from "@/lib/snapshot"
import { isValidProjectPath } from "@/lib/path-validation"
import { isProtectedFile } from "@/lib/protected-files"
import { getBranchHeadSha } from "@/lib/github"
import {
  createChangeset,
  validateChangesetFiles,
  MAX_CHANGESET_FILES,
  type ChangesetFile
} from "@/lib/changesets"

// Fase 3 (Master Plan v1.3, Taak B) voegt prepare_changeset toe naast de
// twee bestaande, read-only tools. Belangrijk: deze tool schrijft NOOIT
// naar GitHub — de implementatie hieronder doet uitsluitend een
// Firestore-schrijfactie (createChangeset, status "proposed"). Alleen een
// expliciete approve-aanroep via app/api/changesets/:id/approve (los van
// deze tool, buiten Claude's bereik) kan daadwerkelijk committen.
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
  },
  {
    name: "prepare_changeset",
    description: `Stel een codewijziging voor. Dit COMMIT NIETS — het maakt uitsluitend een voorstel aan dat de gebruiker in CodeSync te zien krijgt als een diff, met een Goedkeuren/Afwijzen-keuze. Gebruik dit pas nadat je de relevante bestanden hebt gelezen (get_file_contents) en zeker weet wat de wijziging moet zijn. Maximaal ${MAX_CHANGESET_FILES} bestanden per changeset.`,
    input_schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          maxItems: MAX_CHANGESET_FILES,
          items: {
            type: "object",
            properties: {
              path: { type: "string", description: "Relatief bestandspad, bijv. 'app/page.tsx'" },
              action: { type: "string", enum: ["create", "modify", "delete"] },
              content: { type: "string", description: "Volledige nieuwe bestandsinhoud. Verplicht bij create/modify, weglaten bij delete." }
            },
            required: ["path", "action"]
          }
        },
        explanation: {
          type: "string",
          description: "Korte, mensleesbare samenvatting van wat er verandert en waarom — dit ziet de gebruiker in de review."
        }
      },
      required: ["files", "explanation"],
      additionalProperties: false
    }
  }
]

const MAX_TOTAL_BYTES = 200_000 // groottebegrenzing bovenop het max. van 10 paden

export async function executeClaudeTool(
  toolName: string,
  input: Record<string, unknown>,
  project: Project,
  conversationId?: string
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

    if (toolName === "prepare_changeset") {
      const rawFiles = input.files
      const explanation = typeof input.explanation === "string" ? input.explanation : ""

      if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
        return { result: "Fout: 'files' moet een niet-lege array zijn.", isError: true }
      }
      if (!explanation.trim()) {
        return { result: "Fout: 'explanation' is verplicht.", isError: true }
      }

      const files: ChangesetFile[] = rawFiles.map((f: any) => ({
        path: String(f?.path ?? ""),
        action: f?.action,
        content: typeof f?.content === "string" ? f.content : undefined
      }))

      // Validatie ook al hier bij het voorstellen (snelle feedback aan
      // Claude) — dit is GEEN vervanging van de verplichte server-side
      // re-validatie bij approval (die gebeurt apart, opnieuw, in
      // lib/changesets.ts approveChangeset()).
      const errors = validateChangesetFiles(files)
      if (errors.length > 0) {
        return {
          result: JSON.stringify({ error: "Changeset ongeldig", details: errors }),
          isError: true
        }
      }

      const baseCommitSha = await getBranchHeadSha(project.githubRepo, project.branch)

      const changeset = await createChangeset({
        projectSlug: project.slug,
        conversationId,
        files,
        explanation,
        baseCommitSha
      })

      return {
        result: JSON.stringify({
          changesetId: changeset.id,
          status: changeset.status,
          message: "Voorstel aangemaakt. De gebruiker ziet dit nu in CodeSync als een wijzigingsvoorstel en kan het bekijken en goedkeuren of afwijzen. Dit is nog NIET gecommit."
        }),
        isError: false
      }
    }

    return { result: `Onbekende tool: ${toolName}`, isError: true }

  } catch (error) {
    return { result: `Tool-fout: ${String(error)}`, isError: true }
  }
}
