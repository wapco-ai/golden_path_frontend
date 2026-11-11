import React from 'react';
import './SortableTableHeader.css';

export default function SortableTableHeader({ column, sort, onSort, children }) {
  const [activeColumn, direction] = sort.split(':');
  const isActive = activeColumn === column;
  const ascending = direction === 'asc';
  return (
    <th scope="col" aria-sort={isActive ? (ascending ? 'ascending' : 'descending') : undefined}>
      <button type="button" className="admin-table-sort" onClick={() => onSort(column)}>
        {children}
        <span aria-hidden="true">{isActive ? (ascending ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}
