export function cameraPresentation(isRetry: boolean) {
  return { eyebrow: isRetry ? 'FOLLOW-UP' : 'SNAP', instruction: 'Keep one problem inside the frame' } as const
}
