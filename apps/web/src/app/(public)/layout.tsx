import { ReactNode } from 'react'

import { MaybeSessionProvider } from '@latitude-data/web-ui/browser'
import { getCurrentUser } from '$/services/auth/getCurrentUser'

/**
 * This layout is here only to add providers.
 * Don't put any DIVs or other HTML elements here.
 * Public pages are very different between each other.
 */
export default async function PublicLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  const { user } = await getCurrentUser()

  return (
    <MaybeSessionProvider currentUser={user}>{children}</MaybeSessionProvider>
  )
}
