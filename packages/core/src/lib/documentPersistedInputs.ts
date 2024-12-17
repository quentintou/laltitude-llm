import { ParameterType } from '../constants'

export const INPUT_SOURCE = {
  manual: 'manual',
  dataset: 'dataset',
  history: 'history',
} as const

export type InputSource = (typeof INPUT_SOURCE)[keyof typeof INPUT_SOURCE]
type PlaygroundInputMetadata = {
  type?: ParameterType
  filename?: string
  includeInPrompt?: boolean
}

export type PlaygroundInput<S extends InputSource> = S extends 'dataset'
  ? {
    value: string
    metadata: PlaygroundInputMetadata & { includeInPrompt: boolean }
  }
  : {
    value: string
    metadata: PlaygroundInputMetadata
  }

type ManualInput = PlaygroundInput<'manual'>
type DatasetInput = PlaygroundInput<'dataset'>
type HistoryInput = PlaygroundInput<'history'>

export type Inputs<S extends InputSource> = Record<string, PlaygroundInput<S>>

export type LinkedDataset = {
  rowIndex: number | undefined
  inputs: Record<string, DatasetInput>
  mappedInputs: Record<string, number>
}

export type PlaygroundInputs<S extends InputSource> = {
  source: S
  manual: {
    inputs: Record<string, ManualInput>
  }
  // DEPRECATED: This is persisted in DB. Leave it for now
  // Eventually can be removed
  dataset: LinkedDataset & {
    datasetId: number | undefined
  }
  history: {
    logUuid: string | undefined
    inputs: Record<string, HistoryInput>
  }
}
