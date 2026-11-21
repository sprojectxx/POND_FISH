'use client';

import React from 'react';

/**
 * AdminTableSkeleton — Modern shimmer skeleton rows for data tables.
 * Displays clean, fluid placeholder rows during data fetches without layout shifts or intrusive popups.
 */
export default function AdminTableSkeleton({ columns = 10, rows = 5 }) {
  // Preset realistic column widths (%) for varied natural look
  const widthPresets = ['65%', '85%', '50%', '75%', '60%', '70%', '45%', '80%', '55%', '40%'];

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <tr
          key={`skel-row-${rowIdx}`}
          style={{
            borderBottom: '1px solid #F1F5F9',
            background: rowIdx % 2 === 0 ? '#FFFFFF' : '#FAFCFF',
          }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => {
            const width = widthPresets[(colIdx + rowIdx) % widthPresets.length];
            const isLast = colIdx === columns - 1;
            const isPill = colIdx === 6 || colIdx === 2; // Status or source badge style

            return (
              <td
                key={`skel-cell-${rowIdx}-${colIdx}`}
                style={{
                  padding: '16px',
                  verticalAlign: 'middle',
                  textAlign: isLast ? 'right' : 'left',
                }}
              >
                {isPill ? (
                  <div
                    className="pf-skeleton"
                    style={{
                      height: '24px',
                      width: '76px',
                      borderRadius: '12px',
                      display: 'inline-block',
                    }}
                  />
                ) : isLast ? (
                  <div
                    className="pf-skeleton"
                    style={{
                      height: '28px',
                      width: '64px',
                      borderRadius: '6px',
                      display: 'inline-block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div
                      className="pf-skeleton"
                      style={{
                        height: '14px',
                        width: width,
                        maxWidth: '140px',
                        minWidth: '50px',
                      }}
                    />
                    {colIdx === 1 && (
                      <div
                        className="pf-skeleton"
                        style={{
                          height: '10px',
                          width: '55%',
                          maxWidth: '90px',
                        }}
                      />
                    )}
                  </div>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
