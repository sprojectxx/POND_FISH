'use client';

import React, { useState, useRef, useEffect } from 'react';

/**
 * AdminSelect — Premium custom themed dropdown matching PondFish brand aesthetic.
 * Replaces native HTML <select> with a polished, accessible dropdown with smooth hover,
 * active indicator, checkmark, and custom styling.
 */
export default function AdminSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  disabled = false,
  className = '',
  style = {},
  buttonStyle = {},
  menuStyle = {},
  align = 'left',
  placement = 'bottom',
  size = 'md',
  icon = null,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Normalize options to { value, label }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: opt, label: String(opt) };
    }
    if (opt && typeof opt === 'object') {
      const val = opt.value !== undefined ? opt.value : opt.id !== undefined ? opt.id : '';
      const lbl = opt.label !== undefined ? opt.label : opt.name !== undefined ? opt.name : String(val);
      return { value: val, label: lbl };
    }
    return { value: '', label: '' };
  });

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const isSmall = size === 'sm';

  return (
    <div
      ref={containerRef}
      className={`pf-admin-select ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: isSmall ? '100px' : '150px',
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: '#FFFFFF',
          border: isOpen ? '1px solid #1E56A0' : '1px solid #CBD5E1',
          borderRadius: '8px',
          padding: isSmall ? '5px 10px' : '9px 13px',
          fontSize: isSmall ? '12px' : '13px',
          fontWeight: '600',
          color: '#0F2C59',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen
            ? '0 0 0 2px rgba(30, 86, 160, 0.15)'
            : '0 1px 2px rgba(15, 44, 89, 0.04)',
          transition: 'all 0.15s ease',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'left',
          boxSizing: 'border-box',
          ...buttonStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {icon && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayLabel}
          </span>
        </div>

        {/* Chevron Icon */}
        <svg
          width={isSmall ? '11' : '13'}
          height={isSmall ? '11' : '13'}
          viewBox="0 0 24 24"
          fill="none"
          stroke={isOpen ? '#1E56A0' : '#64748B'}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease, stroke 0.15s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            ...(placement === 'top'
              ? {
                  bottom: 'calc(100% + 5px)',
                  boxShadow: '0 -10px 25px rgba(15, 44, 89, 0.14), 0 -4px 10px rgba(15, 44, 89, 0.05)',
                }
              : {
                  top: 'calc(100% + 5px)',
                  boxShadow: '0 10px 25px rgba(15, 44, 89, 0.14), 0 4px 10px rgba(15, 44, 89, 0.05)',
                }),
            [align === 'right' ? 'right' : 'left']: 0,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: '300px',
            background: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #CBD5E1',
            zIndex: 100,
            padding: '5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            maxHeight: '260px',
            overflowY: 'auto',
            boxSizing: 'border-box',
            ...menuStyle,
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
              No options available
            </div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange && onChange(opt.value);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    padding: isSmall ? '6px 10px' : '8px 12px',
                    background: isSelected ? '#EFF6FF' : 'transparent',
                    color: isSelected ? '#1E56A0' : '#334155',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: isSmall ? '12px' : '13px',
                    fontWeight: isSelected ? '700' : '500',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background 0.1s ease',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>

                  {/* Checkmark icon for selected option */}
                  {isSelected && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#1E56A0"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, marginLeft: '6px' }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
