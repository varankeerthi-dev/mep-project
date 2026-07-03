export function DataTablePagination() {
  return (
    <div className="flex justify-between text-xs">
      <span>Showing 1–10 of 100</span>
      <div className="flex gap-2">
        <button>Prev</button>
        <button>1</button>
        <button>Next</button>
      </div>
    </div>
  )
}
