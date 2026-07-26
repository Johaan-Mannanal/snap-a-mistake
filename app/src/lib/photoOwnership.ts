export type PhotoOwnershipCoordinator = {
  runExclusive<T>(task: () => Promise<T>): Promise<T>
}

export function createPhotoOwnershipCoordinator(): PhotoOwnershipCoordinator {
  let tail = Promise.resolve()
  return {
    async runExclusive(task) {
      const previous = tail
      let release!: () => void
      tail = new Promise<void>((resolve) => { release = resolve })
      await previous
      try {
        return await task()
      } finally {
        release()
      }
    },
  }
}

export const photoOwnershipCoordinator = createPhotoOwnershipCoordinator()
