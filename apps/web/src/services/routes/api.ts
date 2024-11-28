export const _API_ROUTES = {
  workspaces: {
    current: '/api/workspaces/current',
    usage: '/api/workspaces/usage',
  },
  apiKeys: {
    root: '/api/apiKeys',
  },
  providerApiKeys: {
    root: '/api/providerApiKeys',
  },
  claimedRewards: {
    root: '/api/claimedRewards',
  },
  providerLogs: {
    root: '/api/providerLogs',
  },
  users: {
    root: '/api/users',
  },
  projects: {
    root: '/api/projects',
    detail: (id: number) => {
      const projectRoot = `/api/projects/${id}`
      return {
        forImport: {
          root: `${projectRoot}/documents-for-import`,
        },
        stats: {
          root: `${projectRoot}/stats`,
        },
        commits: {
          root: `${projectRoot}/commits`,
          detail: (commitUuid: string) => ({
            root: `${projectRoot}/commits/${commitUuid}`,
            documents: {
              root: `${projectRoot}/commits/${commitUuid}/documents`,
              detail: (documentUuid: string) => {
                const documentRoot = `${projectRoot}/commits/${commitUuid}/documents/${documentUuid}`
                return {
                  root: documentRoot,
                  documentLogs: {
                    root: `${documentRoot}/documentLogs`,
                    pagination: `${documentRoot}/documentLogs/pagination`,
                    aggregations: `${documentRoot}/documentLogs/aggregations`,
                    dailyCount: `${documentRoot}/documentLogs/daily-count`,
                    detail: (documentLogUuid: string) => {
                      return {
                        position: `${documentRoot}/documentLogs/${documentLogUuid}/position`,
                      }
                    },
                  },
                  evaluations: {
                    root: `${documentRoot}/evaluations`,
                    detail: ({ evaluationId }: { evaluationId: number }) => ({
                      root: `${documentRoot}/evaluations/${evaluationId}`,
                      logs: {
                        root: `${documentRoot}/evaluations/${evaluationId}/logs`,
                      },
                      evaluationResults: {
                        root: `${documentRoot}/evaluations/${evaluationId}/evaluation-results`,
                        pagination: `${documentRoot}/evaluations/${evaluationId}/evaluation-results/pagination`,
                        counters: `${documentRoot}/evaluations/${evaluationId}/evaluation-results/counters`,
                        mean: `${documentRoot}/evaluations/${evaluationId}/evaluation-results/mean`,
                        modal: `${documentRoot}/evaluations/${evaluationId}/evaluation-results/modal`,
                        average: `${documentRoot}/evaluations/${evaluationId}/evaluation-results/average`,
                        averageAndCost: `${documentRoot}/evaluations/${evaluationId}/evaluation-results/average-and-cost`,
                      },
                    }),
                  },
                  evaluationResultsByDocumentContent: {
                    detail: ({ evaluationId }: { evaluationId: number }) => ({
                      root: `${documentRoot}/evaluation-results-by-document-content/${evaluationId}`,
                      pagination: `${documentRoot}/evaluation-results-by-document-content/${evaluationId}/pagination`,
                    }),
                  },
                }
              },
            },
          }),
        },
        publishedDocuments: {
          root: `${projectRoot}/published-documents`,
        },
      }
    },
  },
  datasets: {
    root: '/api/datasets',
    detail: (id: number) => ({
      preview: {
        root: `/api/datasets/${id}/preview`,
      },
    }),
  },
  evaluationTemplates: {
    root: '/api/evaluationTemplates',
  },
  documentLogs: {
    detail: ({ id }: { id: number }) => ({
      root: `/api/documentLogs/${id}`,
    }),
    uuids: {
      detail: ({ uuid }: { uuid: string }) => {
        const root = `/api/documentLogs/uuids/${uuid}`
        return {
          root,
        }
      },
    },
    evaluationResults: {
      root: `/api/documentLogs/evaluation-results`,
    },
    generateCsv: {
      detail: ({ documentLogIds }: { documentLogIds: number[] }) => {
        return {
          root: `/api/documentLogs/generate-csv?ids=${documentLogIds.join(',')}`,
        }
      },
    },
  },
  evaluations: {
    root: '/api/evaluations',
    detail: (id: number) => ({
      root: `/api/evaluations/${id}`,
      connectedDocuments: {
        root: `/api/evaluations/${id}/connected-documents`,
      },
      prompt: {
        root: `/api/evaluations/${id}/prompt`,
      },
    }),
  },
}
