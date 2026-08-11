import React from 'react'

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="페이지 이동">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
      >
        이전
      </button>
      <span aria-live="polite">
        {pagination.page} / {pagination.totalPages} 페이지 · 총 {pagination.total}건
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
      >
        다음
      </button>
    </nav>
  )
}
