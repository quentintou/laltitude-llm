'use client'

import {
  ComponentPropsWithoutRef,
  ElementRef,
  forwardRef,
  ReactNode,
} from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '$ui/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

const TooltipRoot = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

type TooltipVariant = 'default' | 'destructive'
type PropviderProps = ComponentPropsWithoutRef<typeof TooltipProvider>
type RootProps = ComponentPropsWithoutRef<typeof TooltipRoot>
type ContentProps = ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
> & {
  variant?: TooltipVariant
}
const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ContentProps
>(({ className, variant = 'default', sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      'z-50 overflow-hidden rounded-md text-white px-3 py-1.5 text-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
      'max-w-72',
      className,
      {
        'bg-foreground': variant === 'default',
        'bg-destructive': variant === 'destructive',
      },
    )}
    {...props}
  />
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

type Props = PropviderProps &
  RootProps &
  ContentProps & {
    trigger: ReactNode
    children: ReactNode
  }
function Tooltip({
  children,
  trigger,
  // Provider
  delayDuration,
  disableHoverableContent,

  // Root
  open,
  defaultOpen,
  onOpenChange,

  // Content
  variant,
  side,
  sideOffset,
  align,
  alignOffset,
  arrowPadding,
  avoidCollisions,
  collisionBoundary,
  collisionPadding,
  sticky,
  hideWhenDetached,
  updatePositionStrategy,
}: Props) {
  return (
    <TooltipRoot
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      <TooltipTrigger asChild onClick={(e) => e.preventDefault()}>
        {trigger}
      </TooltipTrigger>
      <TooltipPrimitive.Portal>
        <TooltipContent
          variant={variant}
          side={side}
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          arrowPadding={arrowPadding}
          avoidCollisions={avoidCollisions}
          collisionBoundary={collisionBoundary}
          collisionPadding={collisionPadding}
          sticky={sticky}
          hideWhenDetached={hideWhenDetached}
          updatePositionStrategy={updatePositionStrategy}
        >
          {children}
        </TooltipContent>
      </TooltipPrimitive.Portal>
    </TooltipRoot>
  )
}

export { Tooltip, TooltipProvider }
