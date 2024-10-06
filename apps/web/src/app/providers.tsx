'use client'

import { ReactNode, useEffect } from 'react'

import { User, Workspace } from '@latitude-data/core/browser'
import { envClient } from '$/envClient'
import posthog from 'posthog-js'
import { PostHogProvider, usePostHog } from 'posthog-js/react'

if (
  typeof window !== 'undefined' &&
  envClient.NEXT_PUBLIC_POSTHOG_KEY &&
  envClient.NEXT_PUBLIC_POSTHOG_HOST
) {
  posthog.init(envClient.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: envClient.NEXT_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
    disable_session_recording: true,
  })
}
export function CSPostHogProvider({ children }: { children: ReactNode }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

export function IdentifyUser({
  user,
  workspace,
  children,
}: {
  user: User
  workspace: Workspace
  children: ReactNode
}) {
  const posthog = usePostHog()

  useEffect(() => {
    try {
      if (user && !user.email.match(/@latitude\.so/)) {
        posthog?.identify(user.id, {
          email: user.email,
        })
        posthog?.group('workspace', String(workspace.id))
        posthog?.startSessionRecording()
      }
    } catch (_) {
      // do nothing, just to avoid crashing the app
    }
  }, [posthog, user.id, user.email, workspace.id])

  return children
}
