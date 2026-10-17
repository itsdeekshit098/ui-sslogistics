export interface PaginationProps {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  /** The list is fetching — shows a spinner on the phone "Load more". */
  loading?: boolean;
  /** Phones: load the next batch automatically when the end of the list
   * scrolls into view (timelines like the activity log) instead of waiting
   * for a tap on "Load more". */
  autoLoad?: boolean;
}
