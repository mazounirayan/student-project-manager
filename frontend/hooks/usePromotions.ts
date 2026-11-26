import { promotionService, type Promotion } from "@/services/PromotionService"
import { errorMessage } from "@/lib/api"
import { compareText } from "@/lib/people"
import { useState, useEffect, useCallback } from "react"

/** Années récentes d’abord, puis ordre alphabétique : le même classement que l’API. */
export const sortPromotions = (list: Promotion[]) => [...list].sort((a, b) => b.year - a.year || compareText(a.name, b.name))

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPromotions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await promotionService.getAll()
      setPromotions(Array.isArray(data) ? sortPromotions(data) : [])
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger les promotions."))
      setPromotions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPromotions()
  }, [fetchPromotions])

  return { promotions, loading, error, fetchPromotions, setPromotions }
}
