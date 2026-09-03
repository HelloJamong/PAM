import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useDebouncedValue } from './useDebouncedValue.js'

// 검색어 디바운스 + status 필터 + 페이지 오버플로 보정을 공유하는 목록 조회 훅.
// search/status/page는 호출 측이 소유하고, 필터 변경 시 page를 1로 되돌리는 책임도 호출 측에 있다.
export function usePaginatedList(path, { search = '', status = '', limit = 25 }) {
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search)

  const reload = useCallback(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (status) params.set('status', status)
    params.set('page', page)
    params.set('limit', String(limit))
    api.get(`${path}?${params}`)
      .then(res => {
        if (res.pagination.page > res.pagination.totalPages) {
          setPage(res.pagination.totalPages)
          return
        }
        setItems(res.data)
        setPagination(res.pagination)
        setError('')
      })
      .catch(err => setError(err.message))
  }, [path, debouncedSearch, status, page, limit])

  useEffect(() => { reload() }, [reload])

  return { items, pagination, error, setError, page, setPage, reload }
}
