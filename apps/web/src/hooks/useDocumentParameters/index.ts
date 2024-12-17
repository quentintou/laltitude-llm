import { useCallback, useMemo } from 'react'

import { recalculateInputs } from '$/hooks/useDocumentParameters/recalculateInputs'
import {
  DatasetSource,
  DocumentLog,
  DocumentVersion,
  INPUT_SOURCE,
  Inputs,
  InputSource,
  PlaygroundInput,
  PlaygroundInputs,
} from '@latitude-data/core/browser'
import type { ConversationMetadata } from 'promptl-ai'
import { AppLocalStorage, useLocalStorage } from '@latitude-data/web-ui'

const EMPTY_INPUTS: PlaygroundInputs<'manual'> = {
  source: INPUT_SOURCE.manual,
  manual: { inputs: {} },
  dataset: {
    datasetId: undefined,
    rowIndex: undefined,
    inputs: {},
    mappedInputs: {},
  },
  history: { logUuid: undefined, inputs: {} },
}

function convertToParams(inputs: Inputs<InputSource>) {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, input]) => {
      try {
        return [key, JSON.parse(input.value)]
      } catch (e) {
        return [key, input?.value?.toString?.()]
      }
    }),
  )
}

function getDocState(oldState: InputsByDocument | null, key: string) {
  const state = oldState ?? {}
  const doc = state[key] ?? EMPTY_INPUTS
  return { state, doc }
}

function getValue({ paramValue }: { paramValue: unknown | undefined }) {
  try {
    const value =
      typeof paramValue === 'string' ? paramValue : JSON.stringify(paramValue)
    return { value, metadata: { includeInPrompt: paramValue !== undefined } }
  } catch {
    return { value: '', metadata: { includeInPrompt: false } }
  }
}

function mapLogParametersToInputs({
  inputs,
  parameters,
}: {
  inputs: Inputs<'history'>
  parameters: DocumentLog['parameters'] | undefined
}): Inputs<'history'> | undefined {
  const params = parameters ?? {}
  // No parameters
  if (!Object.keys(params).length) return undefined

  return Object.entries(inputs).reduce((acc, [key]) => {
    acc[key] = getValue({ paramValue: params[key] })
    return acc
  }, {} as Inputs<'history'>)
}

type InputsByDocument = Record<string, PlaygroundInputs<InputSource>>

export function useDocumentParameters({
  document,
  commitVersionUuid,
}: {
  document: DocumentVersion
  commitVersionUuid: string
}) {
  // TODO: Delete stale inputs as new inputs could eventually not fit
  const { value: allInputs, setValue } = useLocalStorage<InputsByDocument>({
    key: AppLocalStorage.playgroundParameters,
    defaultValue: {},
  })
  const key = `${commitVersionUuid}:${document.documentUuid}`
  const inputs = allInputs[key] ?? EMPTY_INPUTS
  const source = inputs.source
  const inputsBySource = inputs[source].inputs

  const setInputs = useCallback(
    <S extends InputSource>(source: S, newInputs: Inputs<S>) => {
      setValue((oldState) => {
        const { state, doc } = getDocState(oldState, key)
        const prevSource = doc[source]
        return {
          ...state,
          [key]: {
            ...doc,
            [source]: {
              ...prevSource,
              inputs: newInputs,
            },
          },
        }
      })
    },
    [allInputs, key, source, setValue],
  )

  const setManualInputs = useCallback(
    (newInputs: Inputs<'manual'>) => setInputs(INPUT_SOURCE.manual, newInputs),
    [setInputs],
  )

  const setDatasetInputs = useCallback(
    (newInputs: Inputs<'dataset'>) =>
      // TODO: Persists in DB
      setInputs(INPUT_SOURCE.dataset, newInputs),
    [setInputs],
  )

  const setHistoryInputs = useCallback(
    (newInputs: Inputs<'history'>) =>
      setInputs(INPUT_SOURCE.history, newInputs),
    [setInputs],
  )

  const setInput = useCallback(
    <S extends InputSource>(
      source: S,
      value: PlaygroundInput<S>,
      param: string,
    ) => {
      inputs
      switch (source) {
        case INPUT_SOURCE.manual:
          setManualInputs({ ...inputsBySource, [param]: value })
          break
        case INPUT_SOURCE.history:
          setHistoryInputs({ ...inputsBySource, [param]: value })
          break
      }
    },
    [source, inputsBySource, setInputs],
  )

  const setManualInput = useCallback(
    (param: string, value: PlaygroundInput<'manual'>) => {
      setInput(source, value, param)
    },
    [setInput],
  )

  const setHistoryInput = useCallback(
    (param: string, value: PlaygroundInput<'history'>) => {
      setInput(source, value, param)
    },
    [setInput, source],
  )

  const setSource = useCallback(
    (source: InputSource) => {
      setValue((prev) => {
        const { state, doc } = getDocState(prev, key)
        return {
          ...state,
          [key]: {
            ...doc,
            source,
          },
        }
      })
    },
    [key, setValue],
  )

  const setDataset = useCallback(
    (selected: DatasetSource) => {
      setValue((old) => {
        const { state, doc } = getDocState(old, key)
        return {
          ...state,
          [key]: {
            ...doc,
            dataset: {
              ...doc.dataset,
              ...selected,
            },
          },
        }
      })
    },
    [allInputs, key, setValue],
  )

  const copyDatasetInputsToManual = useCallback(() => {
    setManualInputs(inputs['dataset'].inputs)
  }, [inputs])

  const setHistoryLog = useCallback(
    (logUuid: string) => {
      setValue((old) => {
        const { state, doc } = getDocState(old, key)
        return {
          ...state,
          [key]: {
            ...doc,
            history: {
              ...doc.history,
              logUuid,
            },
          },
        }
      })
    },
    [allInputs, key, setValue],
  )

  const mapDocParametersToInputs = useCallback(
    ({
      parameters,
      source,
    }: {
      parameters: DocumentLog['parameters']
      source: InputSource
    }) => {
      const state = allInputs[key]
      if (!state) return

      const docState = state[source]
      const sourceInputs = docState.inputs
      const newInputs = mapLogParametersToInputs({
        inputs: sourceInputs,
        parameters,
      })
      if (!newInputs) return

      setInputs(source, newInputs)
    },
    [inputs, key, setInputs],
  )

  const onMetadataProcessed = useCallback(
    (metadata: ConversationMetadata) => {
      setInputs(
        'manual',
        recalculateInputs({
          inputs: inputs.manual.inputs,
          metadata,
        }),
      )
      // TODO: Persists in DB
      setInputs(
        'dataset',
        recalculateInputs({
          inputs: inputs.dataset.inputs,
          metadata,
        }),
      )
      setInputs(
        'history',
        recalculateInputs({
          inputs: inputs.history.inputs,
          metadata,
        }),
      )
    },
    [inputs, setInputs, source],
  )

  const parameters = useMemo(
    () => convertToParams(inputsBySource),
    [inputsBySource],
  )

  return {
    parameters,
    onMetadataProcessed,
    source,
    setSource,
    setInput,
    mapDocParametersToInputs,
    manual: {
      inputs: inputs['manual'].inputs,
      setInput: setManualInput,
      setInputs: setManualInputs,
    },
    dataset: {
      // TODO: Fetch from DB
      datasetId: inputs['dataset'].datasetId,
      rowIndex: inputs['dataset'].rowIndex,
      inputs: inputs['dataset'].inputs,
      mappedInputs: inputs['dataset'].mappedInputs,
      setInputs: setDatasetInputs,
      copyToManual: copyDatasetInputsToManual,
      setDataset,
    },
    history: {
      logUuid: inputs['history'].logUuid,
      inputs: inputs['history'].inputs,
      setInput: setHistoryInput,
      setInputs: setHistoryInputs,
      setHistoryLog,
    },
  }
}
