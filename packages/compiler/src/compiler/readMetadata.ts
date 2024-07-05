import { createHash } from 'crypto'

import {
  CUSTOM_MESSAGE_ROLE_ATTR,
  CUSTOM_MESSAGE_TAG,
  REFERENCE_PROMPT_ATTR,
} from '$/constants'
import CompileError, { error } from '$/error/error'
import errors from '$/error/errors'
import parse from '$/parser/index'
import type {
  Attribute,
  BaseNode,
  ElementTag,
  TemplateNode,
  ToolCallTag,
} from '$/parser/interfaces'
import { ConversationMetadata, MessageRole } from '$/types'
import { Node as LogicalExpression } from 'estree'

import { ReferencePromptFn } from './compile'
import { readConfig } from './config'
import { updateScopeContextForNode } from './logic'
import { ScopeContext } from './scope'
import { isContentTag, isMessageTag, isRefTag, isToolCallTag } from './utils'

function copyScopeContext(scopeContext: ScopeContext): ScopeContext {
  return {
    ...scopeContext,
    definedVariables: new Set(scopeContext.definedVariables),
  }
}

export class ReadMetadata {
  private rawText: string
  private referenceFn?: ReferencePromptFn

  private referencedPrompts: Record<string, string> = {}
  private accumulatedToolCalls: ToolCallTag[] = []

  constructor({
    prompt,
    referenceFn,
  }: {
    prompt: string
    referenceFn?: ReferencePromptFn
    configSchema?: object
  }) {
    this.rawText = prompt
    this.referenceFn = referenceFn
  }

  async run(): Promise<ConversationMetadata> {
    const fragment = parse(this.rawText)
    const config = readConfig(fragment)
    const scopeContext = {
      usedUndefinedVariables: new Set<string>(),
      definedVariables: new Set<string>(),
    }
    await this.readBaseMetadata({
      node: fragment,
      scopeContext,
      isInsideMessageTag: false,
      isInsideContentTag: false,
    })

    const hash = createHash('sha256')
    hash.update(this.rawText)
    Object.values(this.referencedPrompts).forEach((refHash: string) => {
      hash.update(refHash)
    })
    const hashValue = hash.digest('hex')

    return {
      hash: hashValue,
      parameters: scopeContext.usedUndefinedVariables,
      referencedPrompts: new Set(Object.keys(this.referencedPrompts)),
      config,
    }
  }

  private async updateScopeContext({
    node,
    scopeContext,
  }: {
    node: LogicalExpression
    scopeContext: ScopeContext
  }): Promise<void> {
    await updateScopeContextForNode({
      node,
      scopeContext,
      raiseError: this.expressionError.bind(this),
    })
  }

  private async listTagAttributes({
    tagNode,
    scopeContext,
    literalAttributes = [], // Tags that don't allow Mustache expressions
  }: {
    tagNode: ElementTag
    scopeContext: ScopeContext
    literalAttributes?: string[]
  }): Promise<Set<string>> {
    const attributeNodes = tagNode.attributes
    if (attributeNodes.length === 0) return new Set()

    const attributes: Set<string> = new Set()
    for (const attributeNode of attributeNodes) {
      const { name, value } = attributeNode
      if (value === true) {
        attributes.add(name)
        continue
      }

      if (literalAttributes.includes(name)) {
        if (value.some((node) => node.type === 'MustacheTag')) {
          this.baseNodeError(
            errors.invalidStaticAttribute(name),
            value.find((node) => node.type === 'MustacheTag')!,
          )
        }
      }

      for await (const node of value) {
        if (node.type === 'MustacheTag') {
          const expression = node.expression
          await this.updateScopeContext({ node: expression, scopeContext })
        }
      }

      attributes.add(name)
    }

    return attributes
  }

  private async readBaseMetadata({
    node,
    scopeContext,
    isInsideMessageTag,
    isInsideContentTag,
  }: {
    node: TemplateNode
    scopeContext: ScopeContext
    isInsideMessageTag: boolean
    isInsideContentTag: boolean
  }): Promise<void> {
    if (node.type === 'Fragment') {
      for await (const childNode of node.children ?? []) {
        await this.readBaseMetadata({
          node: childNode,
          scopeContext,
          isInsideMessageTag,
          isInsideContentTag,
        })
      }
      return
    }

    if (
      node.type === 'Config' ||
      node.type === 'Comment' ||
      node.type === 'Text'
    ) {
      /* do nothing */
      return
    }

    if (node.type === 'MustacheTag') {
      const expression = node.expression
      await this.updateScopeContext({ node: expression, scopeContext })
      return
    }

    if (node.type === 'IfBlock') {
      const ifScope = copyScopeContext(scopeContext)
      const elseScope = copyScopeContext(scopeContext)
      for await (const childNode of node.children ?? []) {
        await this.readBaseMetadata({
          node: childNode,
          scopeContext: ifScope,
          isInsideMessageTag,
          isInsideContentTag,
        })
      }
      for await (const childNode of node.else?.children ?? []) {
        await this.readBaseMetadata({
          node: childNode,
          scopeContext: elseScope,
          isInsideMessageTag,
          isInsideContentTag,
        })
      }
      return
    }

    if (node.type === 'EachBlock') {
      const elseScope = copyScopeContext(scopeContext)
      for await (const childNode of node.else?.children ?? []) {
        await this.readBaseMetadata({
          node: childNode,
          scopeContext: elseScope,
          isInsideMessageTag,
          isInsideContentTag,
        })
      }

      const contextVarName = node.context.name
      const indexVarName = node.index?.name
      if (scopeContext.definedVariables.has(contextVarName)) {
        throw this.expressionError(
          errors.variableAlreadyDeclared(contextVarName),
          node.context,
        )
      }
      if (indexVarName && scopeContext.definedVariables.has(indexVarName)) {
        throw this.expressionError(
          errors.variableAlreadyDeclared(indexVarName),
          node.index!,
        )
      }

      const iterableScope = copyScopeContext(scopeContext)
      iterableScope.definedVariables.add(contextVarName)
      if (indexVarName) {
        iterableScope.definedVariables.add(indexVarName)
      }
      for await (const childNode of node.children ?? []) {
        await this.readBaseMetadata({
          node: childNode,
          scopeContext: iterableScope,
          isInsideMessageTag,
          isInsideContentTag,
        })
      }
      return
    }

    if (node.type === 'ElementTag') {
      if (isToolCallTag(node)) {
        if (isInsideContentTag) {
          this.baseNodeError(errors.toolCallTagInsideContent, node)
        }

        const attributes = await this.listTagAttributes({
          tagNode: node,
          scopeContext,
        })

        if (!attributes.has('id')) {
          this.baseNodeError(errors.toolCallTagWithoutId, node)
        }

        if (!attributes.has('name')) {
          this.baseNodeError(errors.toolCallWithoutName, node)
        }

        for await (const childNode of node.children ?? []) {
          await this.readBaseMetadata({
            node: childNode,
            scopeContext,
            isInsideMessageTag,
            isInsideContentTag: true,
          })
        }

        this.accumulatedToolCalls.push(node as ToolCallTag)
        return
      }

      if (isContentTag(node)) {
        if (isInsideContentTag) {
          this.baseNodeError(errors.contentTagInsideContent, node)
        }

        for await (const childNode of node.children ?? []) {
          await this.readBaseMetadata({
            node: childNode,
            scopeContext,
            isInsideMessageTag,
            isInsideContentTag: true,
          })
        }
        return
      }

      if (isMessageTag(node)) {
        if (isInsideContentTag || isInsideMessageTag) {
          this.baseNodeError(errors.messageTagInsideMessage, node)
        }

        const attributes = await this.listTagAttributes({
          tagNode: node,
          scopeContext,
        })

        const role = node.name as MessageRole
        if (node.name === CUSTOM_MESSAGE_TAG) {
          if (!attributes.has(CUSTOM_MESSAGE_ROLE_ATTR)) {
            this.baseNodeError(errors.messageTagWithoutRole, node)
          }
          attributes.delete(CUSTOM_MESSAGE_ROLE_ATTR)
        }

        if (role === MessageRole.tool && !attributes.has('id')) {
          this.baseNodeError(errors.toolMessageWithoutId, node)
        }

        if (this.accumulatedToolCalls.length > 0) {
          this.accumulatedToolCalls.forEach((toolCallNode) => {
            this.baseNodeError(errors.invalidToolCallPlacement, toolCallNode)
          })
        }
        this.accumulatedToolCalls = []

        for await (const childNode of node.children ?? []) {
          await this.readBaseMetadata({
            node: childNode,
            scopeContext,
            isInsideMessageTag: true,
            isInsideContentTag,
          })
        }

        if (
          role !== MessageRole.assistant &&
          this.accumulatedToolCalls.length > 0
        ) {
          this.accumulatedToolCalls.forEach((toolCallNode) => {
            this.baseNodeError(errors.invalidToolCallPlacement, toolCallNode)
          })
        }
        this.accumulatedToolCalls = []
        return
      }

      if (isRefTag(node)) {
        if (isInsideMessageTag || isInsideContentTag) {
          this.baseNodeError(errors.invalidReferencePromptPlacement, node)
        }

        if (node.children?.length ?? 0 > 0) {
          this.baseNodeError(errors.referenceTagHasContent, node)
        }

        const attributes = await this.listTagAttributes({
          tagNode: node,
          scopeContext,
          literalAttributes: [REFERENCE_PROMPT_ATTR],
        })

        if (!attributes.has(REFERENCE_PROMPT_ATTR)) {
          this.baseNodeError(errors.referenceTagWithoutPrompt, node)
        }

        if (!this.referenceFn) {
          this.baseNodeError(errors.missingReferenceFunction, node)
        }

        const refPromptAttribute = node.attributes.find(
          (attribute: Attribute) => attribute.name === REFERENCE_PROMPT_ATTR,
        ) as Attribute

        const refPromptPath = (refPromptAttribute.value as TemplateNode[])
          .map((node) => node.data)
          .join('')

        if (this.referencedPrompts[refPromptPath]) return
        try {
          const refPrompt = await this.referenceFn(refPromptPath)

          const refReadMetadata = new ReadMetadata({
            prompt: refPrompt,
            referenceFn: this.referenceFn,
          })
          refReadMetadata.referencedPrompts = this.referencedPrompts
          refReadMetadata.accumulatedToolCalls = this.accumulatedToolCalls

          const refPromptMetadata = await refReadMetadata.run()
          refPromptMetadata.parameters.forEach((param: string) => {
            if (!scopeContext.definedVariables.has(param)) {
              scopeContext.usedUndefinedVariables.add(param)
            }
          })
          this.accumulatedToolCalls = refReadMetadata.accumulatedToolCalls

          this.referencedPrompts[refPromptPath] = refPromptMetadata.hash
        } catch (error: unknown) {
          if (error instanceof CompileError) throw error
          this.baseNodeError(errors.referenceError(error), node)
        }
        return
      }

      this.baseNodeError(errors.unknownTag(node.name), node)
    }

    //@ts-ignore - Linter knows this should be unreachable. That's what this error is for.
    this.baseNodeError(errors.unsupportedBaseNodeType(node.type), node)
  }

  private baseNodeError(
    { code, message }: { code: string; message: string },
    node: BaseNode,
  ): never {
    error(message, {
      name: 'CompileError',
      code,
      source: this.rawText || '',
      start: node.start || 0,
      end: node.end || undefined,
    })
  }

  private expressionError(
    { code, message }: { code: string; message: string },
    node: LogicalExpression,
  ): never {
    const source = (node.loc?.source ?? this.rawText)!.split('\n')
    const start =
      source
        .slice(0, node.loc?.start.line! - 1)
        .reduce((acc, line) => acc + line.length + 1, 0) +
      node.loc?.start.column!
    const end =
      source
        .slice(0, node.loc?.end.line! - 1)
        .reduce((acc, line) => acc + line.length + 1, 0) + node.loc?.end.column!

    error(message, {
      name: 'CompileError',
      code,
      source: this.rawText || '',
      start,
      end,
    })
  }
}
