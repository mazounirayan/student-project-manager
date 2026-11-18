import { promotionService, type Promotion } from "@/services/PromotionService"
import { useState, useEffect, useCallback } from "react"

export function usePromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPromotions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await promotionService.getAll()
      setPromotions(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les promotions.")
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
