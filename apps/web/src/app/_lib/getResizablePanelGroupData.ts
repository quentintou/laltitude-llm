import { cookies } from 'next/headers'

export enum ResizableGroups {
  DocumentSidebar = 'document-sidebar',
}
export const MIN_SIDEBAR_WIDTH_PX = 280

/**
 * This method is meant to be used in a nextjs page with access to the cookies object.
 */
export async function getResizablePanelGroupData({
  group,
}: {
  group: ResizableGroups
}): Promise<number | undefined> {
  const cks = await cookies()
  const layout = cks.get(`react-resizable-panels:${group}`)
  let layoutData = undefined

  try {
    if (layout) {
      layoutData = JSON.parse(layout.value)
    }
  } catch {
    // do nothing
  }

  return layoutData
}
