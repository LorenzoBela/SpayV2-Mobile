import { useCallback, useState } from 'react'

/** One validity entry per mounted editor, including bulk rows. */
export function useSplitValidity() {
  const [validity, setValidity] = useState<Record<string, boolean>>({})
  const report = useCallback((key: string, valid: boolean) => {
    setValidity(previous => previous[key] === valid ? previous : { ...previous, [key]: valid })
  }, [])
  return { invalid: Object.values(validity).some(valid => !valid), report }
}
