import { HEAD_COMMIT } from '@latitude-data/core/browser'

export enum DocumentRoutes {
  editor = 'editor',
  logs = 'logs',
}

export const ROUTES = {
  root: '/',
  settings: {
    root: '/settings',
  },
  dashboard: {
    root: '/dashboard',
    projects: {
      new: {
        root: `/dashboard/projects/new`,
      },
      destroy: (id: number) => {
        return { root: `/dashboard/projects/${id}/destroy` }
      },
    },
  },
  projects: {
    root: '/projects',
    detail: ({ id }: { id: number }) => {
      const root = `/projects/${id}`
      const rootCommits = `${root}/versions`
      return {
        root,
        commits: {
          root: rootCommits,
          latest: `${rootCommits}/${HEAD_COMMIT}`,
          detail: ({ uuid }: { uuid: string }) => {
            const root = `${rootCommits}/${uuid}`
            const rootDocuments = `${root}/documents`
            return {
              root,
              documents: {
                root: rootDocuments,
                detail: ({ uuid }: { uuid: string }) => {
                  const root = `${rootDocuments}/${uuid}`
                  return {
                    root: `${root}`,
                    [DocumentRoutes.editor]: {
                      root: `${root}`,
                    },
                    [DocumentRoutes.logs]: {
                      root: `${root}/${DocumentRoutes.logs}`,
                    },
                  }
                },
              },
            }
          },
        },
      }
    },
  },
  auth: {
    setup: '/setup',
    login: '/login',
    magicLinkSent: (email: string) => `/magic-links/sent?email=${email}`,
    magicLinks: {
      confirm: (token: string) => `/magic-links/confirm/${token}`,
    },
  },
} as const
