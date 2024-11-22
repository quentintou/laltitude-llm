'use client'

import React, {
  createContext,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  Commit,
  DocumentVersion,
  EvaluationDto,
  ProviderApiKey,
} from '@latitude-data/core/browser'
import { type EvaluationResultByDocument } from '@latitude-data/core/repositories'
import {
  Button,
  DocumentTextEditor,
  DocumentTextEditorFallback,
  SplitPane,
  Text,
  Tooltip,
  useCurrentCommit,
  useCurrentProject,
} from '@latitude-data/web-ui'
import { createDraftWithContentAction } from '$/actions/commits/createDraftWithContentAction'
import { requestSuggestionAction } from '$/actions/copilot/requestSuggestion'
import { publishEventAction } from '$/actions/events/publishEventAction'
import { type AddMessagesActionFn } from '$/actions/sdk/addMessagesAction'
import type { RunDocumentActionFn } from '$/actions/sdk/runDocumentAction'
import EditorHeader from '$/components/EditorHeader'
import { useDocumentParameters } from '$/hooks/useDocumentParameters'
import useLatitudeAction from '$/hooks/useLatitudeAction'
import { useMetadata } from '$/hooks/useMetadata'
import { ROUTES } from '$/services/routes'
import useDocumentVersions from '$/stores/documentVersions'
import useProviderApiKeys from '$/stores/providerApiKeys'
import { useRouter } from 'next/navigation'
import { DiffOptions } from 'node_modules/@latitude-data/web-ui/src/ds/molecules/DocumentTextEditor/types'
import { useDebouncedCallback } from 'use-debounce'

import Playground from './Playground'
import RefineDocumentModal from './RefineModal'
import { UpdateToPromptLButton } from './UpdateToPromptl'
import { useRefinement } from './useRefinement'

export const DocumentEditorContext = createContext<
  | {
      runDocumentAction: RunDocumentActionFn
      addMessagesAction: AddMessagesActionFn
    }
  | undefined
>(undefined)

export default function DocumentEditor({
  runDocumentAction,
  addMessagesAction,
  document: _document,
  documents: _documents,
  providerApiKeys,
  freeRunsCount,
  evaluation: serverEvaluation,
  evaluationResults: serverEvaluationResults,
}: {
  runDocumentAction: Function
  addMessagesAction: Function
  document: DocumentVersion
  documents: DocumentVersion[]
  providerApiKeys?: ProviderApiKey[]
  freeRunsCount?: number
  evaluation: EvaluationDto | undefined
  evaluationResults: EvaluationResultByDocument[]
}) {
  const { execute: publishEvent } = useLatitudeAction(publishEventAction)
  const { commit } = useCurrentCommit()
  const { project } = useCurrentProject()
  const router = useRouter()
  const refinement = useRefinement({
    projectId: project.id,
    commitUuid: commit.uuid,
    document: _document,
    serverEvaluation,
    serverEvaluationResults,
  })
  const { execute: createDraftWithContent } = useLatitudeAction(
    createDraftWithContentAction,
    {
      onSuccess: ({ data: draft }: { data: Commit }) => {
        router.push(
          ROUTES.projects
            .detail({ id: project.id })
            .commits.detail({ uuid: draft.uuid })
            .documents.detail({ uuid: _document.documentUuid }).root,
        )
      },
    },
  )
  const { data: providers } = useProviderApiKeys({
    fallbackData: providerApiKeys,
  })
  const { data: documents, updateContent } = useDocumentVersions(
    {
      commitUuid: commit.uuid,
      projectId: project.id,
    },
    {
      fallbackData: _documents,
    },
  )

  const document = useMemo(
    () =>
      documents?.find((d) => d.documentUuid === _document.documentUuid) ??
      _document,
    [documents],
  )

  const [value, setValue] = useState(_document.content)
  const [isSaved, setIsSaved] = useState(true)

  const [diff, setDiff] = useState<DiffOptions>()
  const handleSuggestion = useCallback(
    (suggestion: string) => {
      const onAccept = (newValue: string) => {
        setDiff(undefined)
        publishEvent({
          eventType: 'copilotRefinerApplied',
          payload: {
            projectId: project.id,
            commitUuid: commit.uuid,
            documentUuid: _document.documentUuid,
          },
        })

        if (!commit.mergedAt) {
          onChange(newValue)
          return
        }

        createDraftWithContent({
          title: `Refined '${document.path.split('/').pop()}'`,
          content: newValue,
          documentUuid: document.documentUuid,
          projectId: project.id,
        })
      }

      setDiff({
        newValue: suggestion,
        description: 'Generated suggestion',
        onAccept,
        onReject: () => {
          setDiff(undefined)
        },
      })
    },
    [
      document.documentUuid,
      document.path,
      commit.mergedAt,
      publishEvent,
      project.id,
      commit.uuid,
    ],
  )

  const debouncedSave = useDebouncedCallback(
    (val: string) => {
      updateContent({
        commitUuid: commit.uuid,
        projectId: project.id,
        documentUuid: document.documentUuid,
        content: val,
      })

      setIsSaved(true)
    },
    500,
    { trailing: true },
  )

  const { onMetadataProcessed } = useDocumentParameters({
    commitVersionUuid: commit.uuid,
    documentVersionUuid: document.documentUuid,
  })
  const { metadata, runReadMetadata } = useMetadata({
    onMetadataProcessed: onMetadataProcessed,
  })

  useEffect(() => {
    runReadMetadata({
      prompt: value,
      documents,
      document,
      fullPath: document.path,
      promptlVersion: document.promptlVersion,
    })
  }, [document.promptlVersion])

  const onChange = useCallback(
    (newValue: string) => {
      setIsSaved(false)
      setValue(newValue)
      debouncedSave(newValue)
      runReadMetadata({
        prompt: newValue,
        documents,
        document,
        fullPath: document.path,
        promptlVersion: document.promptlVersion,
      })
    },
    [runReadMetadata, document.path, document.promptlVersion],
  )

  const {
    execute: executeRequestSuggestionAction,
    isPending: isCopilotLoading,
  } = useLatitudeAction(requestSuggestionAction, {
    onSuccess: ({
      data: suggestion,
    }: {
      data: { code: string; response: string }
    }) => {
      setDiff({
        newValue: suggestion.code,
        description: suggestion.response,
        onAccept: (newValue: string) => {
          setDiff(undefined)
          publishEvent({
            eventType: 'copilotSuggestionApplied',
            payload: {
              projectId: project.id,
              commitUuid: commit.uuid,
              documentUuid: document.documentUuid,
            },
          })
          onChange(newValue)
        },
        onReject: () => {
          setDiff(undefined)
        },
      })
    },
  })
  const requestSuggestion = useCallback(
    (prompt: string) => {
      executeRequestSuggestionAction({
        projectId: project.id,
        commitUuid: commit.uuid,
        documentUuid: document.documentUuid,
        request: prompt,
      })
    },
    [executeRequestSuggestionAction],
  )

  const isMerged = commit.mergedAt !== null

  const RefineButton = (
    <Button
      disabled={document.promptlVersion === 0}
      className='bg-background'
      variant='outline'
      size='small'
      iconProps={{
        name: 'sparkles',
        size: 'small',
      }}
      onClick={refinement.modal.onOpen}
    >
      <Text.H6>Refine</Text.H6>
    </Button>
  )

  return (
    <>
      {refinement.modal.open ? (
        <RefineDocumentModal
          onClose={refinement.modal.onClose}
          serverEvaluation={refinement.server.evaluation}
          serverEvaluationResults={refinement.server.evaluationResults}
          documentVersion={document}
          setDocumentContent={handleSuggestion}
        />
      ) : null}
      <DocumentEditorContext.Provider
        value={{
          runDocumentAction: runDocumentAction as RunDocumentActionFn,
          addMessagesAction: addMessagesAction as AddMessagesActionFn,
        }}
      >
        <SplitPane
          className='p-6'
          initialPercentage={55}
          minWidth={300}
          leftPane={
            <SplitPane.Pane>
              <div className='pr-4 flex flex-col flex-1 flex-grow flex-shrink gap-2 min-w-0'>
                <EditorHeader
                  providers={providers}
                  disabledMetadataSelectors={isMerged}
                  title='Prompt editor'
                  rightActions={<UpdateToPromptLButton document={document} />}
                  metadata={metadata}
                  prompt={value}
                  onChangePrompt={onChange}
                  freeRunsCount={freeRunsCount}
                  showCopilotSetting
                />
                <Suspense fallback={<DocumentTextEditorFallback />}>
                  <DocumentTextEditor
                    value={value}
                    metadata={metadata}
                    onChange={onChange}
                    diff={diff}
                    readOnlyMessage={
                      isMerged ? 'Create a draft to edit documents.' : undefined
                    }
                    isSaved={isSaved}
                    actionButtons={
                      document.promptlVersion === 0 ? (
                        <Tooltip trigger={RefineButton}>
                          Upgrade the syntax of the document to use the Refine
                          feature.
                        </Tooltip>
                      ) : (
                        RefineButton
                      )
                    }
                    copilot={{
                      isLoading: isCopilotLoading,
                      requestSuggestion,
                      disabledMessage:
                        document.promptlVersion === 0
                          ? 'Copilot is disabled for prompts using the old syntax. Upgrade to use Copilot.'
                          : undefined,
                    }}
                  />
                </Suspense>
              </div>
            </SplitPane.Pane>
          }
          rightPane={
            <SplitPane.Pane>
              <div className='pl-4 flex-1 relative max-h-full'>
                <Playground document={document} metadata={metadata!} />
              </div>
            </SplitPane.Pane>
          }
        />
      </DocumentEditorContext.Provider>
    </>
  )
}
