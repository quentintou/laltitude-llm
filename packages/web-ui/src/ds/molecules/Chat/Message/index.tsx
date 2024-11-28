'use client'

import { ReactNode, useState } from 'react'

import {
  ContentType,
  MessageContent,
  PromptlSourceRef,
  ToolContent,
  ToolRequestContent,
} from '@latitude-data/compiler'

import { cn } from '../../../../lib/utils'
import { Badge, CodeBlock, Skeleton, Text, Tooltip } from '../../../atoms'
import { colors, TextColor } from '../../../tokens'
import { roleVariant } from './helpers'

export { roleVariant } from './helpers'

export type MessageProps = {
  role: string
  content: MessageContent[] | string
  className?: string
  size?: 'default' | 'small'
  animatePulse?: boolean
  parameters?: Record<string, unknown>
  collapseParameters?: boolean
}

export function Message({
  role,
  content,
  animatePulse,
  size = 'default',
  parameters = {},
  collapseParameters = false,
}: MessageProps) {
  const [collapseMessage, setCollapseMessage] = useState(false)
  return (
    <div
      className={cn('flex flex-col gap-1 w-full items-start', {
        'animate-pulse': animatePulse,
      })}
    >
      <div>
        <Badge variant={roleVariant(role)}>
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
      </div>
      <div className='flex w-full flex-row items-stretch gap-4 pl-4'>
        <div
          className='flex-shrink-0 bg-muted w-1 rounded-lg cursor-pointer hover:bg-primary transition-colors'
          onClick={() => setCollapseMessage(!collapseMessage)}
        />
        <div className={cn('flex flex-1 flex-col gap-1')}>
          {collapseMessage ? (
            <Content value='...' color='foregroundMuted' size={size} />
          ) : typeof content === 'string' ? (
            <Content value={content} color='foregroundMuted' size={size} />
          ) : (
            content.map((c, idx) => (
              <Content
                key={idx}
                index={idx}
                color='foregroundMuted'
                value={c}
                size={size}
                parameters={parameters}
                collapseParameters={collapseParameters}
                sourceMap={(c as any)?._promptlSourceMap}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export function MessageSkeleton({ role }: { role: string }) {
  return (
    <div className='flex flex-col gap-1 w-full items-start animate-pulse'>
      <div>
        <Badge variant={roleVariant(role)}>
          <div className='w-16' />
        </Badge>
      </div>
      <div className='flex flex-row items-stretch gap-4 pl-4 w-full'>
        <div className='flex-shrink-0 bg-muted w-1 rounded-lg' />
        <div className='flex flex-col gap-1 flex-grow min-w-0'>
          <Skeleton height='h5' className='w-1/2' />
          <Skeleton height='h5' className='w-3/4' />
        </div>
      </div>
    </div>
  )
}

const Content = ({
  index = 0,
  color,
  value,
  size,
  parameters = {},
  collapseParameters = false,
  sourceMap = [],
}: {
  index?: number
  color: TextColor
  value: string | MessageContent
  size?: 'default' | 'small'
  parameters?: Record<string, unknown>
  collapseParameters?: boolean
  sourceMap?: PromptlSourceRef[]
}) => {
  if (typeof value === 'string') {
    return (
      <ContentText
        index={index}
        color={color}
        message={value}
        size={size}
        parameters={parameters}
        collapseParameters={collapseParameters}
        sourceMap={sourceMap}
      />
    )
  }

  switch (value.type) {
    case ContentType.text:
      return (
        <ContentText
          index={index}
          color={color}
          message={value.text}
          size={size}
          parameters={parameters}
          collapseParameters={collapseParameters}
          sourceMap={sourceMap}
        />
      )

    case ContentType.image:
      return (
        <ContentText
          index={index}
          color={color}
          message={'<Image content not implemented yet>'}
          size={size}
        />
      )

    case ContentType.toolCall:
      return (
        <div className='pt-2 w-full'>
          <div className='overflow-hidden rounded-lg w-full'>
            <CodeBlock language='json'>
              {JSON.stringify(value as ToolRequestContent, null, 2)}
            </CodeBlock>
          </div>
        </div>
      )

    case ContentType.toolResult:
      return (
        <div className='pt-2 w-full'>
          <div className='overflow-hidden rounded-lg w-full'>
            <CodeBlock language='json'>
              {JSON.stringify(value as ToolContent, null, 2)}
            </CodeBlock>
          </div>
        </div>
      )

    default:
      return null
  }
}

const ContentText = ({
  index = 0,
  color,
  message,
  size,
  parameters = {},
  collapseParameters = false,
  sourceMap = [],
}: {
  index?: number
  color: TextColor
  message: string
  size?: 'default' | 'small'
  parameters?: Record<string, unknown>
  collapseParameters?: boolean
  sourceMap?: PromptlSourceRef[]
}) => {
  const TextComponent = size === 'small' ? Text.H6 : Text.H5

  // Filter source map references without value
  sourceMap = sourceMap.filter(
    (ref) => message.slice(ref.start, ref.end).trim().length > 0,
  )

  // Sort source map to ensure references are ordered
  sourceMap = sourceMap.sort((a, b) => a.start - b.start)

  const segments = segmentMessage(
    message,
    sourceMap,
    parameters,
    collapseParameters,
  )
  const groups = groupSegmentsByNewLine(segments)

  return groups.map((group, groupIndex) => (
    <TextComponent
      color={color}
      whiteSpace='preWrap'
      wordBreak='breakAll'
      key={`${index}-group-${groupIndex}`}
    >
      {group.length > 0
        ? group.map((segment, segmentIndex) => (
            <span key={`${index}-group-${groupIndex}-segment-${segmentIndex}`}>
              {segment}
            </span>
          ))
        : '\n'}
    </TextComponent>
  ))
}

type Segment = string | ReactNode

function identifierSegment(
  message: string,
  sourceRef: PromptlSourceRef,
  collapseParameters: boolean,
) {
  if (collapseParameters) {
    return (
      <Tooltip
        asChild
        trigger={
          <Badge variant='accent'>
            &#123;&#123;{sourceRef.identifier}&#125;&#125;
          </Badge>
        }
      >
        <div className='line-clamp-6'>
          {message.slice(sourceRef.start, sourceRef.end)}
        </div>
      </Tooltip>
    )
  }

  return (
    <Tooltip
      asChild
      trigger={
        <span className={colors.textColors.accentForeground}>
          {message.slice(sourceRef.start, sourceRef.end)}
        </span>
      }
    >
      <div className='line-clamp-6'>{sourceRef.identifier}</div>
    </Tooltip>
  )
}

function dynamicSegment(
  message: string,
  sourceRef: PromptlSourceRef,
  collapseParameters: boolean,
) {
  if (collapseParameters) {
    return (
      <Tooltip
        asChild
        trigger={
          <Badge variant='yellow'>&#123;&#123;dynamic&#125;&#125;</Badge>
        }
      >
        <div className='line-clamp-6'>
          {message.slice(sourceRef.start, sourceRef.end)}
        </div>
      </Tooltip>
    )
  }

  return (
    <Tooltip
      asChild
      trigger={
        <span className={colors.textColors.warningMutedForeground}>
          {message.slice(sourceRef.start, sourceRef.end)}
        </span>
      }
    >
      <div className='line-clamp-6'>dynamic</div>
    </Tooltip>
  )
}

function segmentMessage(
  message: string,
  sourceMap: PromptlSourceRef[],
  parameters: Record<string, unknown>,
  collapseParameters: boolean,
): Segment[] {
  let segments: Segment[] = []

  const firstSegment = message.slice(0, sourceMap[0]?.start ?? message.length)
  if (firstSegment.length > 0) segments.push(firstSegment)

  for (let i = 0; i < sourceMap.length; i++) {
    if (sourceMap[i]!.identifier && !!parameters[sourceMap[i]!.identifier!]) {
      segments.push(
        identifierSegment(message, sourceMap[i]!, collapseParameters),
      )
    } else {
      segments.push(dynamicSegment(message, sourceMap[i]!, collapseParameters))
    }

    const nextSegment = message.slice(
      sourceMap[i]!.end,
      sourceMap[i + 1]?.start ?? message.length,
    )
    if (nextSegment.length > 0) segments.push(nextSegment)
  }

  return segments
}

function groupSegmentsByNewLine(segments: Segment[]) {
  let groups: Segment[][] = []
  let currentGroup: Segment[] = []

  for (const segment of segments) {
    if (typeof segment === 'string') {
      const subsegments = segment.split('\n')
      for (let i = 0; i < subsegments.length; i++) {
        if (subsegments[i]!.length > 0) currentGroup.push(subsegments[i])
        if (i < subsegments.length - 1) {
          groups.push(currentGroup)
          currentGroup = []
        }
      }
    } else {
      currentGroup.push(segment)
    }
  }

  if (currentGroup.length > 0) groups.push(currentGroup)

  return groups
}
