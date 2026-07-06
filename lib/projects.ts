import type { Project } from "@/types"

export const PROJECTS: Project[] = [
  // ACTIVE — full AI management
  {
    slug: "codesnap",
    vercelProject: "codesnap",
    name: "CodeSnap",
    githubRepo: "stuctech-eng/codesnap",
    branch: "main",
    status: "active",
    stack: ["Next.js 15", "TypeScript", "Firebase", "Vercel"],
    keyFiles: [
      { path: "app/page.tsx", description: "Main page" },
      { path: "lib/firebase.ts", description: "Firebase config" },
      { path: "lib/auth.ts", description: "Auth service" }
    ]
  },
  {
    slug: "coachos",
    vercelProject: "coach-os",
    name: "CoachOS",
    githubRepo: "stuctech-eng/coachOS",
    branch: "main",
    status: "active",
    stack: ["Next.js 15", "TypeScript", "Supabase", "Vercel"],
    keyFiles: [
      { path: "app/page.tsx", description: "Dashboard" },
      { path: "lib/supabase.ts", description: "Supabase client" }
    ]
  },
  {
    slug: "lottoapp",
    vercelProject: "lotto-app",
    name: "LottoApp",
    githubRepo: "stuctech-eng/LottoApp",
    branch: "main",
    status: "active",
    stack: ["Next.js 15", "TypeScript", "Vercel"],
    keyFiles: [
      { path: "app/page.tsx", description: "Main page" }
    ]
  },
  {
    slug: "codelab",
    vercelProject: "codelab",
    name: "Codelab",
    githubRepo: "stuctech-eng/codelab",
    branch: "main",
    status: "active",
    stack: ["Next.js 15", "TypeScript", "Vercel"],
    keyFiles: [
      { path: "app/page.tsx", description: "Main page" }
    ]
  },
  {
    slug: "code-cleaner",
    name: "Code Cleaner",
    githubRepo: "stuctech-eng/Code-cleaner",
    branch: "main",
    status: "active",
    stack: ["Next.js 15", "TypeScript", "Vercel"],
    keyFiles: [
      { path: "app/page.tsx", description: "Main page" }
    ]
  },
  {
    slug: "polder",
    vercelProject: "polder",
    name: "Polder",
    githubRepo: "stuctech-eng/polder",
    branch: "main",
    status: "active",
    stack: ["Next.js 15", "TypeScript", "Vercel"],
    keyFiles: [
      { path: "app/page.tsx", description: "Main page" }
    ]
  },
  {
    slug: "codesync",
    vercelProject: "codesync",
    name: "CodeSync",
    githubRepo: "stuctech-eng/codesync",
    branch: "main",
    status: "active",
    stack: ["Next.js 15.3.6", "TypeScript", "GitHub API", "Vercel"],
    keyFiles: [
      { path: "app/page.tsx", description: "Project overzicht" },
      { path: "lib/github.ts", description: "GitHub API service" },
      { path: "lib/diff.ts", description: "Diff engine" },
      { path: "lib/projects.ts", description: "Project registry" },
      { path: "app/api/sync/route.ts", description: "Batch commit" },
      { path: "app/api/snapshot/route.ts", description: "Snapshot ophalen" }
    ]
  },

  // EXPERIMENTAL — light tracking
  {
    slug: "quizmaster-app",
    vercelProject: "quizmaster-app",
    name: "Quizmaster App",
    githubRepo: "stuctech-eng/Quizmaster-App",
    branch: "main",
    status: "experimental"
  },
  {
    slug: "bassflow-pro",
    name: "Bassflow Pro",
    githubRepo: "stuctech-eng/bassflow-pro",
    branch: "main",
    status: "experimental"
  },
  {
    slug: "party-game",
    name: "Party Game",
    githubRepo: "stuctech-eng/PARTY-GAME",
    branch: "main",
    status: "experimental"
  },
  {
    slug: "pitwall",
    name: "Pitwall",
    githubRepo: "stuctech-eng/Pitwall",
    branch: "main",
    status: "experimental"
  },
  {
    slug: "amutec",
    vercelProject: "amutec-tsa-ra-1640",
    name: "Amutec TSA-RA-1640",
    githubRepo: "stuctech-eng/Amutec-TSA-RA-1640",
    branch: "main",
    status: "experimental"
  },

  // ARCHIVE — read only
  {
    slug: "solitaire-neeltje",
    vercelProject: "solitaire-neeltje",
    name: "Solitaire Neeltje",
    githubRepo: "stuctech-eng/Solitaire-Neeltje",
    branch: "main",
    status: "archive"
  },
  {
    slug: "mahjong-god",
    name: "Mahjong God",
    githubRepo: "stuctech-eng/mahjong-god",
    branch: "main",
    status: "archive"
  },
  {
    slug: "getalgeheugen-pro",
    vercelProject: "getalgeheugen-pro",
    name: "Getalgeheugen Pro",
    githubRepo: "stuctech-eng/Getalgeheugen-pro",
    branch: "main",
    status: "archive"
  },
  {
    slug: "reken-geheugen",
    vercelProject: "reken-geheugen",
    name: "Reken Geheugen",
    githubRepo: "stuctech-eng/Reken-Geheugen-",
    branch: "main",
    status: "archive"
  },
  {
    slug: "hudson-sharp",
    name: "Hudson Sharp",
    githubRepo: "stuctech-eng/Hudson-sharp",
    branch: "main",
    status: "archive"
  }
]
